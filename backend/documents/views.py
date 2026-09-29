import os
import io
import base64
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from core.drf_permissions import IsAdminRole, IsMemberOrAdmin
from core.permissions import get_accessible_documents
from .models import Document, DocumentGroupAccess
from .serializers import DocumentSerializer, DocumentUpdateSerializer


class DocumentListView(generics.ListAPIView):
    """
    GET /api/documents/
    Returns documents accessible to the current user (via permission filter).
    Admins see all documents.
    """
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsMemberOrAdmin]

    def get_queryset(self):
        # ← Uses the shared permission function — same rule as chat retrieval
        qs = get_accessible_documents(self.request.user).select_related("uploaded_by")
        # Optional filters
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(title__icontains=search)
        return qs


class DocumentUploadView(generics.CreateAPIView):
    """
    POST /api/documents/upload/
    Admin only. Saves document, assigns group access, triggers Celery ingestion.
    """
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        from .tasks import ingest_document

        serializer = self.get_serializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        # Save the document (status defaults to 'processing')
        document = serializer.save(uploaded_by=request.user)

        # Fire ingestion task automatically — no manual step required
        ingest_document.delay(document.id)

        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


class DocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/documents/<id>/  — accessible user or admin
    PATCH  /api/documents/<id>/  — admin only (edit title/description/group access)
    DELETE /api/documents/<id>/  — admin only
    """
    permission_classes = [IsAuthenticated, IsMemberOrAdmin]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return DocumentUpdateSerializer
        return DocumentSerializer

    def get_queryset(self):
        return get_accessible_documents(self.request.user)

    def get_object(self):
        # For write operations, only admins can access any document
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            if not (hasattr(self.request.user, "profile") and self.request.user.profile.is_admin):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Admin role required for this action.")
            obj = get_object_or_404(Document, pk=self.kwargs["pk"])
        else:
            # For reads, apply permission filter
            qs = get_accessible_documents(self.request.user)
            obj = get_object_or_404(qs, pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, obj)
        return obj

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        # Delete associated chunks and file
        document.chunks.all().delete()
        if document.file:
            try:
                os.remove(document.file.path)
            except FileNotFoundError:
                pass
        document.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMemberOrAdmin])
def document_serve_view(request, pk):
    """
    GET /api/documents/<id>/serve/
    Serve the actual document file for download/preview.
    Permission check: user's group must have access to this document.
    """
    from core.permissions import get_full_accessible_documents
    accessible_qs = get_full_accessible_documents(request.user)
    document = get_object_or_404(accessible_qs, pk=pk)


    if not document.file:
        raise Http404("File not found.")

    try:
        file_handle = open(document.file.path, "rb")
        response = FileResponse(file_handle, as_attachment=False)
        response["Content-Disposition"] = f'inline; filename="{os.path.basename(document.file.name)}"'
        return response
    except FileNotFoundError:
        raise Http404("File not found on disk.")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def document_status_view(request, pk):
    """
    GET /api/documents/<id>/status/
    Returns current ingestion status. Used for live polling from admin UI.
    """
    # Admins can check any document status
    if hasattr(request.user, "profile") and request.user.profile.is_admin:
        document = get_object_or_404(Document, pk=pk)
    else:
        qs = get_accessible_documents(request.user)
        document = get_object_or_404(qs, pk=pk)

    return Response({
        "id": document.id,
        "status": document.status,
        "chunk_count": document.chunk_count,
        "error_message": document.error_message,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsMemberOrAdmin])
def document_slides_view(request, pk):
    """
    GET /api/documents/<id>/slides/
    Renders PPTX slides via PowerPoint COM automation at 2560x1440 (2K).
    Results are CACHED to disk — first render takes ~5–15s, every subsequent
    open is instant (served from cache in <1s).
    Cache location: media/slide_cache/<doc_id>/
    Cache is invalidated when the source file is newer than the cached slides.
    """
    accessible_qs = get_accessible_documents(request.user)
    document = get_object_or_404(accessible_qs, pk=pk)

    file_type = (document.file_type or "").lower().lstrip(".")
    if file_type not in ("pptx", "ppt"):
        return Response({"error": "Not a PowerPoint file."}, status=400)

    if not document.file:
        raise Http404("File not found.")

    try:
        import shutil
        from django.conf import settings

        pptx_path = os.path.abspath(document.file.path)
        pptx_mtime = os.path.getmtime(pptx_path)

        # --- Disk Cache Directory ---
        media_root = getattr(settings, "MEDIA_ROOT", os.path.join(os.path.dirname(pptx_path), "../../media"))
        cache_dir = os.path.join(media_root, "slide_cache", str(document.id))
        meta_file = os.path.join(cache_dir, "meta.txt")

        # --- Check Cache Hit ---
        cache_valid = False
        cached_slide_count = 0
        if os.path.isdir(cache_dir) and os.path.isfile(meta_file):
            try:
                with open(meta_file, "r") as mf:
                    cached_mtime = float(mf.read().strip())
                if cached_mtime >= pptx_mtime:
                    png_files = sorted(f for f in os.listdir(cache_dir) if f.endswith(".png"))
                    if png_files:
                        cache_valid = True
                        cached_slide_count = len(png_files)
            except Exception:
                pass

        # --- Serve from Cache (instant) ---
        if cache_valid:
            slides_data = []
            png_files = sorted(f for f in os.listdir(cache_dir) if f.endswith(".png"))
            for idx, fname in enumerate(png_files):
                fpath = os.path.join(cache_dir, fname)
                with open(fpath, "rb") as f:
                    img_b64 = base64.b64encode(f.read()).decode("utf-8")
                slides_data.append({
                    "slide_number": idx + 1,
                    "image": f"data:image/png;base64,{img_b64}",
                    "width": 5760,
                    "height": 3240,
                    "cached": True,
                })
            return Response({
                "document_id": document.id,
                "title": document.title,
                "total_slides": len(slides_data),
                "slides": slides_data,
                "renderer": "cache",
            })

        # --- Cache Miss: Render via PowerPoint COM ---
        import tempfile
        import pythoncom
        import win32com.client

        # Prepare fresh cache directory
        shutil.rmtree(cache_dir, ignore_errors=True)
        os.makedirs(cache_dir, exist_ok=True)

        tmp_dir = tempfile.mkdtemp(prefix="aliis_slides_")
        slides_data = []

        try:
            pythoncom.CoInitialize()
            ppt_app = win32com.client.Dispatch("PowerPoint.Application")
            ppt_app.WindowState = 2  # ppWindowMinimized

            prs = ppt_app.Presentations.Open(
                pptx_path,
                ReadOnly=True,
                Untitled=False,
                WithWindow=False,
            )

            total_slides = prs.Slides.Count

            for i in range(1, total_slides + 1):
                slide = prs.Slides(i)
                tmp_path = os.path.join(tmp_dir, f"slide_{i:03d}.png")
                cache_path = os.path.join(cache_dir, f"slide_{i:03d}.png")

                # Export at 5760x3240 (1.5x 4K) — ultra-sharp small text, cached after first render
                slide.Export(tmp_path, "PNG", 5760, 3240)

                # Move to cache
                shutil.move(tmp_path, cache_path)

                # Read from cache for response
                with open(cache_path, "rb") as f:
                    img_b64 = base64.b64encode(f.read()).decode("utf-8")

                slides_data.append({
                    "slide_number": i,
                    "image": f"data:image/png;base64,{img_b64}",
                    "width": 5760,
                    "height": 3240,
                    "cached": False,
                })

            prs.Close()
            ppt_app.Quit()

            # Write cache metadata (source file mtime)
            with open(meta_file, "w") as mf:
                mf.write(str(pptx_mtime))

        finally:
            pythoncom.CoUninitialize()
            shutil.rmtree(tmp_dir, ignore_errors=True)

        return Response({
            "document_id": document.id,
            "title": document.title,
            "total_slides": len(slides_data),
            "slides": slides_data,
            "renderer": "powerpoint_com",
        })

    except ImportError:
        return Response({
            "error": "PowerPoint COM not available. Ensure pywin32 is installed and Microsoft PowerPoint is on this machine."
        }, status=500)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": f"Failed to render slides: {str(e)}"}, status=500)


