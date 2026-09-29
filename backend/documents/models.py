from django.db import models
from django.contrib.auth.models import User
from pgvector.django import VectorField
from django.conf import settings


class Document(models.Model):
    """
    Represents an uploaded file. Ingestion happens asynchronously via Celery.
    Status tracks the ingestion lifecycle.
    """
    STATUS_PROCESSING = "processing"
    STATUS_READY = "ready"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PROCESSING, "Processing"),
        (STATUS_READY, "Ready"),
        (STATUS_FAILED, "Failed"),
    ]

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    file = models.FileField(upload_to="documents/%Y/%m/", max_length=500)
    file_type = models.CharField(max_length=20, blank=True, default="")  # pdf, docx, txt
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="uploaded_documents"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PROCESSING
    )
    error_message = models.TextField(blank=True, default="")
    chunk_count = models.IntegerField(default=0)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.title} [{self.status}]"


class DocumentGroupAccess(models.Model):
    """
    Many-to-many mapping: which Groups can access which Documents.
    Each access entry has an access_level:
      - 'full'    : Group members can view, download, and query the document fully.
      - 'limited' : Group members can see the document exists and query it,
                    but cannot download or view the full content.
    Admin sets the level per document per group.
    """
    ACCESS_FULL = "full"
    ACCESS_LIMITED = "limited"
    ACCESS_CHOICES = [
        (ACCESS_FULL, "Full Access"),
        (ACCESS_LIMITED, "Limited Access"),
    ]

    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="group_accesses"
    )
    # Import Group from accounts lazily to avoid circular imports
    group = models.ForeignKey(
        "accounts.Group", on_delete=models.CASCADE, related_name="document_accesses"
    )
    access_level = models.CharField(
        max_length=20,
        choices=ACCESS_CHOICES,
        default=ACCESS_FULL,
        help_text="Full = view+download+query; Limited = query only, no download.",
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("document", "group")
        ordering = ["document", "group"]

    def __str__(self):
        return f"{self.document.title} → {self.group.name} ({self.access_level})"



class DocumentChunk(models.Model):
    """
    A single text chunk from a Document, with its BGE-M3 embedding stored
    in pgvector for similarity search.
    """
    document = models.ForeignKey(
        Document, on_delete=models.CASCADE, related_name="chunks"
    )
    content = models.TextField()
    embedding = models.JSONField(default=list)  # 1024-dim float vector
    chunk_index = models.IntegerField()  # positional order within document
    metadata = models.JSONField(default=dict, blank=True)  # page number, etc.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["document", "chunk_index"]
        indexes = [
            models.Index(fields=["document"]),
        ]

    def __str__(self):
        return f"Chunk {self.chunk_index} of '{self.document.title}'"
