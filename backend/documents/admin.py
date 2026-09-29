from django.contrib import admin
from .models import Document, DocumentGroupAccess, DocumentChunk


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "uploaded_by", "uploaded_at", "chunk_count")
    list_filter = ("status", "file_type")
    search_fields = ("title",)
    readonly_fields = ("uploaded_at", "updated_at", "chunk_count")


@admin.register(DocumentGroupAccess)
class DocumentGroupAccessAdmin(admin.ModelAdmin):
    list_display = ("document", "group", "granted_at")
    list_filter = ("group",)


@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "chunk_index", "created_at")
    search_fields = ("document__title", "content")
    readonly_fields = ("embedding", "created_at")
