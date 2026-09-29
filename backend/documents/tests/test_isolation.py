"""
documents/tests/test_isolation.py
===================================
Phase 6: Automated tests proving group access isolation.

Tests verify:
1. A user in a restricted group cannot see out-of-scope documents in the list API.
2. A user in a restricted group gets zero chunks for out-of-scope documents
   in the chunk queryset (the one used for RAG retrieval).
3. An admin user can see all documents.
4. Document group access can be changed live after upload.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from accounts.models import Group, UserProfile
from documents.models import Document, DocumentGroupAccess, DocumentChunk
from core.permissions import get_accessible_documents, get_accessible_chunk_queryset


def _make_user(username, group, role="member"):
    user = User.objects.create_user(username=username, password="testpass123")
    profile = user.profile
    profile.group = group
    profile.role = role
    profile.save()
    return user


def _make_document(title, groups, uploaded_by):
    """Create a document and assign it to the given groups."""
    doc = Document.objects.create(
        title=title,
        file="fake/path.txt",
        uploaded_by=uploaded_by,
        status=Document.STATUS_READY,
    )
    for group in groups:
        DocumentGroupAccess.objects.create(document=doc, group=group)
    return doc


def _make_chunk(document, content="Sample content for testing purposes."):
    return DocumentChunk.objects.create(
        document=document,
        content=content,
        embedding=[0.0] * 1024,  # dummy embedding
        chunk_index=0,
    )


class DocumentListIsolationTest(TestCase):
    """Tests for the document list API permission filter."""

    def setUp(self):
        self.admin_user = User.objects.create_superuser("admin", password="adminpass")
        admin_profile = self.admin_user.profile
        admin_profile.role = "admin"
        admin_profile.save()

        self.group_iot = Group.objects.create(name="IoT")
        self.group_presales = Group.objects.create(name="Presales")

        self.user_iot = _make_user("iot_user", self.group_iot)
        self.user_presales = _make_user("presales_user", self.group_presales)

        # Doc A: only IoT can access
        self.doc_iot_only = _make_document("IoT Sensor Guide", [self.group_iot], self.admin_user)

        # Doc B: only Presales can access
        self.doc_presales_only = _make_document("Sales Playbook", [self.group_presales], self.admin_user)

        # Doc C: both groups can access
        self.doc_shared = _make_document("Company Policy", [self.group_iot, self.group_presales], self.admin_user)

    def test_iot_user_sees_own_and_shared_docs(self):
        accessible = get_accessible_documents(self.user_iot)
        accessible_ids = set(accessible.values_list("id", flat=True))
        self.assertIn(self.doc_iot_only.id, accessible_ids)
        self.assertIn(self.doc_shared.id, accessible_ids)

    def test_iot_user_cannot_see_presales_only_doc(self):
        """ISOLATION TEST: IoT user must NOT see the Presales-only document."""
        accessible = get_accessible_documents(self.user_iot)
        accessible_ids = set(accessible.values_list("id", flat=True))
        self.assertNotIn(
            self.doc_presales_only.id,
            accessible_ids,
            "IoT user should NOT see the Presales-only document!",
        )

    def test_presales_user_cannot_see_iot_only_doc(self):
        """ISOLATION TEST: Presales user must NOT see the IoT-only document."""
        accessible = get_accessible_documents(self.user_presales)
        accessible_ids = set(accessible.values_list("id", flat=True))
        self.assertNotIn(
            self.doc_iot_only.id,
            accessible_ids,
            "Presales user should NOT see the IoT-only document!",
        )

    def test_presales_user_sees_own_and_shared_docs(self):
        accessible = get_accessible_documents(self.user_presales)
        accessible_ids = set(accessible.values_list("id", flat=True))
        self.assertIn(self.doc_presales_only.id, accessible_ids)
        self.assertIn(self.doc_shared.id, accessible_ids)

    def test_admin_sees_all_documents(self):
        accessible = get_accessible_documents(self.admin_user)
        accessible_ids = set(accessible.values_list("id", flat=True))
        self.assertIn(self.doc_iot_only.id, accessible_ids)
        self.assertIn(self.doc_presales_only.id, accessible_ids)
        self.assertIn(self.doc_shared.id, accessible_ids)

    def test_user_with_no_group_sees_nothing(self):
        no_group_user = User.objects.create_user("no_group", password="pass")
        no_group_user.profile.group = None
        no_group_user.profile.save()
        accessible = get_accessible_documents(no_group_user)
        self.assertEqual(accessible.count(), 0)


class ChunkIsolationTest(TestCase):
    """
    Tests for the chunk queryset permission filter.
    This is what the RAG chat system uses — proves restricted chunks
    are NEVER included in the retrieval set for unauthorized users.
    """

    def setUp(self):
        self.admin_user = User.objects.create_superuser("admin2", password="adminpass")
        self.admin_user.profile.role = "admin"
        self.admin_user.profile.save()

        self.group_a = Group.objects.create(name="GroupA")
        self.group_b = Group.objects.create(name="GroupB")

        self.user_a = _make_user("user_a", self.group_a)
        self.user_b = _make_user("user_b", self.group_b)

        # Document only accessible to GroupA
        self.secret_doc = _make_document("Secret A Doc", [self.group_a], self.admin_user)
        self.secret_chunk = _make_chunk(self.secret_doc, "Confidential IoT sensor calibration data.")

        # Shared document
        self.shared_doc = _make_document("Shared Doc", [self.group_a, self.group_b], self.admin_user)
        self.shared_chunk = _make_chunk(self.shared_doc, "General company information.")

    def test_user_a_can_see_secret_chunk(self):
        """GroupA user should see chunks from the GroupA-only document."""
        chunks = get_accessible_chunk_queryset(self.user_a)
        chunk_ids = set(chunks.values_list("id", flat=True))
        self.assertIn(self.secret_chunk.id, chunk_ids)

    def test_user_b_cannot_see_secret_chunk(self):
        """
        CRITICAL ISOLATION TEST:
        GroupB user must NEVER see chunks from the GroupA-only document.
        This is what prevents information leakage in the chatbot.
        """
        chunks = get_accessible_chunk_queryset(self.user_b)
        chunk_ids = set(chunks.values_list("id", flat=True))
        self.assertNotIn(
            self.secret_chunk.id,
            chunk_ids,
            "SECURITY VIOLATION: GroupB user can see a GroupA-only chunk! "
            "This would cause the chatbot to leak restricted information.",
        )

    def test_both_users_can_see_shared_chunk(self):
        """Both users should see chunks from the shared document."""
        chunks_a = get_accessible_chunk_queryset(self.user_a)
        chunks_b = get_accessible_chunk_queryset(self.user_b)

        chunk_ids_a = set(chunks_a.values_list("id", flat=True))
        chunk_ids_b = set(chunks_b.values_list("id", flat=True))

        self.assertIn(self.shared_chunk.id, chunk_ids_a)
        self.assertIn(self.shared_chunk.id, chunk_ids_b)

    def test_live_access_change_takes_effect_immediately(self):
        """
        Changing document group access at runtime must take immediate effect.
        No restart, no cache clear — the permission function re-queries every time.
        """
        # Initially, user_b cannot see secret_chunk
        chunks_before = get_accessible_chunk_queryset(self.user_b)
        self.assertNotIn(self.secret_chunk.id, set(chunks_before.values_list("id", flat=True)))

        # Grant GroupB access to the secret document
        DocumentGroupAccess.objects.create(document=self.secret_doc, group=self.group_b)

        # Now user_b should be able to see it — no restart needed
        chunks_after = get_accessible_chunk_queryset(self.user_b)
        self.assertIn(
            self.secret_chunk.id,
            set(chunks_after.values_list("id", flat=True)),
            "Live access grant did not take effect immediately!",
        )

    def test_removing_access_takes_effect_immediately(self):
        """Revoking access must also take immediate effect."""
        # Grant access first
        access = DocumentGroupAccess.objects.create(document=self.secret_doc, group=self.group_b)
        chunks_with_access = get_accessible_chunk_queryset(self.user_b)
        self.assertIn(self.secret_chunk.id, set(chunks_with_access.values_list("id", flat=True)))

        # Revoke access
        access.delete()

        # Must not be visible anymore
        chunks_without_access = get_accessible_chunk_queryset(self.user_b)
        self.assertNotIn(
            self.secret_chunk.id,
            set(chunks_without_access.values_list("id", flat=True)),
            "Access revocation did not take effect immediately!",
        )
