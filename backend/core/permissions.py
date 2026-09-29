"""
core/permissions.py
===================
THE single source of truth for document access control.

Access Rules:
- Admins: Complete access to view, download, edit, and query all documents.
- Full Access Groups (e.g. IoT or custom Full Access groups):
  Group members can view, download, and query all allowed system documents.
- Limited Access Groups (e.g. Presales or custom Limited Access groups):
  Group members can ONLY access documents explicitly assigned to their group by Admin.
  AI Chatbot RAG is strictly restricted to ONLY search chunks belonging to their assigned documents.
  Raw file downloads & full document viewers are restricted for limited access groups.
- No Group / No Access: Cannot view or query any document.
"""
from django.db.models import QuerySet, Q


def get_accessible_documents(user) -> QuerySet:
    """
    Return QuerySet of Documents accessible to user (for AI RAG Chat & Document List).
    """
    from documents.models import Document

    # Admins see everything
    if hasattr(user, "profile") and user.profile.is_admin:
        return Document.objects.all()

    # Member must have a group assigned
    group = getattr(getattr(user, "profile", None), "group", None)
    if group is None:
        return Document.objects.none()

    # Full Access group members see all system documents
    if getattr(group, "default_access_level", "full") == "full":
        return Document.objects.all()

    # Limited Access groups (e.g. Presales): ONLY see documents assigned to their group!
    return Document.objects.filter(
        group_accesses__group=group
    ).distinct()


def get_full_accessible_documents(user) -> QuerySet:
    """
    Return QuerySet of Documents where user has FULL access (allowing raw document downloads & full viewers).
    """
    from documents.models import Document, DocumentGroupAccess

    if hasattr(user, "profile") and user.profile.is_admin:
        return Document.objects.all()

    group = getattr(getattr(user, "profile", None), "group", None)
    if group is None:
        return Document.objects.none()

    # Only full access group members or explicit FULL access assignments can download raw files
    if getattr(group, "default_access_level", "full") == "full":
        return Document.objects.all()

    # Check for explicit FULL access override for this group
    return Document.objects.filter(
        group_accesses__group=group,
        group_accesses__access_level=DocumentGroupAccess.ACCESS_FULL,
    ).distinct()


def get_accessible_chunk_queryset(user) -> QuerySet:
    """
    Return QuerySet of DocumentChunks searchable by user in AI RAG Chat.
    Uses get_accessible_documents(user) — strictly guarantees Limited groups ONLY search their assigned documents!
    """
    from documents.models import DocumentChunk

    accessible_docs = get_accessible_documents(user)
    return DocumentChunk.objects.filter(document__in=accessible_docs)


