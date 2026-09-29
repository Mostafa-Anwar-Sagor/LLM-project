"""
documents/tasks.py
==================
Celery tasks for automatic document ingestion.
Triggered automatically on document upload — no manual step required.
"""
import logging
import os
from celery import shared_task

from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def ingest_document(self, document_id: int):
    """
    Full ingestion pipeline for a single document:
      1. Load document record
      2. Extract text from file (PDF/DOCX/TXT)
      3. Split into overlapping chunks
      4. Generate BGE-M3 embeddings
      5. Save DocumentChunk rows with embeddings
      6. Update document status to 'ready'

    On failure: mark document as 'failed' with error message.
    """
    from documents.models import Document, DocumentChunk
    from documents.ingestion import extract_text, chunk_text, embed_texts

    try:
        # ── Step 1: Load document ──────────────────────────────────────────
        document = Document.objects.get(id=document_id)
        logger.info(f"[ingest_document] Starting ingestion for document {document_id}: '{document.title}'")

        # ── Step 2: Extract text ───────────────────────────────────────────
        file_path = document.file.path
        file_ext = os.path.splitext(document.file.name)[1].lstrip(".").lower()
        document.file_type = file_ext
        document.save(update_fields=["file_type"])

        raw_text = extract_text(file_path, file_ext)

        if not raw_text or not raw_text.strip():
            raise ValueError("No text could be extracted from the document.")

        logger.info(f"[ingest_document] Extracted {len(raw_text)} characters from '{document.title}'")

        # ── Step 3: Chunk text ─────────────────────────────────────────────
        chunks = chunk_text(raw_text, chunk_size=600, overlap=75)
        logger.info(f"[ingest_document] Created {len(chunks)} chunks")

        if not chunks:
            raise ValueError("Document text produced no chunks after splitting.")

        # ── Step 4: Generate embeddings ────────────────────────────────────
        chunk_texts_list = [text for _, text in chunks]
        embeddings = embed_texts(chunk_texts_list)
        logger.info(f"[ingest_document] Generated {len(embeddings)} embeddings")

        # ── Step 5: Save chunks with embeddings ────────────────────────────
        # Delete any old chunks (re-ingestion scenario)
        DocumentChunk.objects.filter(document=document).delete()

        chunk_objects = []
        for (chunk_index, chunk_text_content), embedding in zip(chunks, embeddings):
            chunk_objects.append(
                DocumentChunk(
                    document=document,
                    content=chunk_text_content,
                    embedding=embedding,
                    chunk_index=chunk_index,
                    metadata={},
                )
            )

        # Bulk create for efficiency
        DocumentChunk.objects.bulk_create(chunk_objects, batch_size=100)

        # ── Step 6: Mark as ready ──────────────────────────────────────────
        document.status = Document.STATUS_READY
        document.chunk_count = len(chunk_objects)
        document.error_message = ""
        document.save(update_fields=["status", "chunk_count", "error_message"])

        logger.info(
            f"[ingest_document] ✓ Document {document_id} ready: "
            f"{len(chunk_objects)} chunks ingested."
        )
        return {"document_id": document_id, "chunks": len(chunk_objects), "status": "ready"}

    except Document.DoesNotExist:
        logger.error(f"[ingest_document] Document {document_id} not found.")
        return {"error": "Document not found"}

    except Exception as exc:
        logger.error(f"[ingest_document] Failed for document {document_id}: {exc}", exc_info=True)

        # Mark document as failed
        try:
            document = Document.objects.get(id=document_id)
            document.status = Document.STATUS_FAILED
            document.error_message = str(exc)[:500]
            document.save(update_fields=["status", "error_message"])
        except Exception:
            pass

        if not getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
            raise self.retry(exc=exc, countdown=2 ** self.request.retries * 30)
        return {"document_id": document_id, "status": "failed", "error": str(exc)}
