from django.urls import path
from .views import (
    DocumentListView,
    DocumentUploadView,
    DocumentDetailView,
    document_serve_view,
    document_status_view,
    document_slides_view,
)

urlpatterns = [
    path("", DocumentListView.as_view(), name="document-list"),
    path("upload/", DocumentUploadView.as_view(), name="document-upload"),
    path("<int:pk>/", DocumentDetailView.as_view(), name="document-detail"),
    path("<int:pk>/serve/", document_serve_view, name="document-serve"),
    path("<int:pk>/status/", document_status_view, name="document-status"),
    path("<int:pk>/slides/", document_slides_view, name="document-slides"),
]
