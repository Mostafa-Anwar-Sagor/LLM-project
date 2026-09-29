from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.drf_permissions import IsAdminRole
from accounts.models import Group
from accounts.serializers import GroupSerializer


class GroupListCreateView(generics.ListCreateAPIView):
    """List all groups (admin) or all groups for dropdowns."""
    serializer_class = GroupSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return Group.objects.all().order_by("name")


class GroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a group (admin only for write operations)."""
    serializer_class = GroupSerializer
    queryset = Group.objects.all()

    def perform_update(self, serializer):
        group = serializer.save()
        new_level = serializer.validated_data.get("default_access_level")
        if new_level:
            from documents.models import DocumentGroupAccess
            DocumentGroupAccess.objects.filter(group=group).update(access_level=new_level)

    def destroy(self, request, *args, **kwargs):

        group = self.get_object()
        # Warn if group has members
        member_count = group.members.count()
        if member_count > 0:
            return Response(
                {
                    "detail": f"Cannot delete group with {member_count} member(s). "
                    "Reassign or remove users first."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class GroupDocumentAccessView(generics.GenericAPIView):
    """
    GET  /api/groups/<id>/documents/ — Get all documents and current group access level for each.
    POST /api/groups/<id>/documents/ — Bulk update access level ('full', 'limited', or 'none') per document.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request, pk):
        from django.shortcuts import get_object_or_404
        from documents.models import Document, DocumentGroupAccess

        group = get_object_or_404(Group, pk=pk)
        access_map = {
            ga.document_id: ga.access_level
            for ga in DocumentGroupAccess.objects.filter(group=group)
        }

        docs = Document.objects.all().order_by("-uploaded_at")
        results = []
        for d in docs:
            results.append({
                "document_id": d.id,
                "title": d.title,
                "file_type": d.file_type,
                "status": d.status,
                "access_level": access_map.get(d.id, "none"), # 'full', 'limited', or 'none'
            })

        return Response({
            "group_id": group.id,
            "group_name": group.name,
            "documents": results,
        })

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        from documents.models import Document, DocumentGroupAccess

        group = get_object_or_404(Group, pk=pk)
        updates = request.data.get("documents", [])

        for item in updates:
            doc_id = item.get("document_id")
            level = item.get("access_level", "none") # 'full', 'limited', 'none'

            if not doc_id:
                continue

            if level in ("full", "limited"):
                DocumentGroupAccess.objects.update_or_create(
                    document_id=doc_id,
                    group=group,
                    defaults={"access_level": level},
                )
            else:
                # 'none' => revoke access
                DocumentGroupAccess.objects.filter(document_id=doc_id, group=group).delete()

        return Response({
            "message": f"Successfully updated document access for group '{group.name}'.",
        })

