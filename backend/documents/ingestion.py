"""
documents/ingestion.py
======================
Text extraction, chunking, and embedding logic for the RAG pipeline.
Supports PDF, DOCX, TXT, XLSX, CSV, PPTX, MD, JSON, and all text files.
"""
import os
import re
import logging
import hashlib
import numpy as np
from typing import List, Tuple

logger = logging.getLogger(__name__)


# ─── Text Extraction ──────────────────────────────────────────────────────────

def extract_text(file_path: str, file_type: str) -> str:
    """Extract raw text from any document format."""
    file_type = file_type.lower().strip(".")

    if file_type == "pdf":
        return _extract_pdf(file_path)
    elif file_type in ("docx", "doc"):
        return _extract_docx(file_path)
    elif file_type in ("xlsx", "xls"):
        return _extract_excel(file_path)
    elif file_type == "csv":
        return _extract_csv(file_path)
    elif file_type in ("pptx", "ppt"):
        return _extract_pptx(file_path)
    else:
        # Default text reader for txt, md, json, xml, html, etc.
        return _extract_txt(file_path)


def _extract_pdf(file_path: str) -> str:
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.warning(f"pdfplumber failed ({e}), trying pypdf...")
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_docx(file_path: str) -> str:
    from docx import Document as DocxDocument
    doc = DocxDocument(file_path)
    text_parts = []

    # Extract paragraphs
    for p in doc.paragraphs:
        if p.text.strip():
            text_parts.append(p.text.strip())

    # Extract tables (rows and cells)
    for table in doc.tables:
        for row in table.rows:
            cell_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cell_texts:
                unique_cells = []
                for ct in cell_texts:
                    if not unique_cells or unique_cells[-1] != ct:
                        unique_cells.append(ct)
                text_parts.append(" | ".join(unique_cells))

    return "\n\n".join(text_parts)


def _extract_excel(file_path: str) -> str:
    import openpyxl
    wb = openpyxl.load_workbook(file_path, data_only=True)
    lines = []
    for sheetname in wb.sheetnames:
        sheet = wb[sheetname]
        lines.append(f"--- Sheet: {sheetname} ---")
        for row in sheet.iter_rows(values_only=True):
            row_vals = [str(val) for val in row if val is not None]
            if row_vals:
                lines.append(" | ".join(row_vals))
    return "\n".join(lines)


def _extract_csv(file_path: str) -> str:
    import csv
    lines = []
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for row in reader:
            if row:
                lines.append(" | ".join(row))
    return "\n".join(lines)


def _extract_pptx(file_path: str) -> str:
    from pptx import Presentation
    prs = Presentation(file_path)
    text_parts = []
    for i, slide in enumerate(prs.slides, 1):
        slide_text = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                slide_text.append(shape.text.strip())
        if slide_text:
            text_parts.append(f"--- Slide {i} ---\n" + "\n".join(slide_text))
    return "\n\n".join(text_parts)


def _extract_txt(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


# ─── Text Chunking ────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 600, overlap: int = 75) -> List[Tuple[int, str]]:
    """
    Split text into overlapping chunks by token proxy (words).
    Returns list of (chunk_index, chunk_text) tuples.
    """
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    words = text.split()
    total_words = len(words)

    if total_words == 0:
        return []

    chunks = []
    idx = 0
    chunk_index = 0

    while idx < total_words:
        end = min(idx + chunk_size, total_words)
        chunk_words = words[idx:end]
        chunk_text = " ".join(chunk_words)
        chunks.append((chunk_index, chunk_text))
        chunk_index += 1

        step = chunk_size - overlap
        idx += step
        if idx >= total_words:
            break

    return chunks


# ─── Embedding ────────────────────────────────────────────────────────────────

_embedding_model = None
_use_fallback_embeddings = False


def _fallback_embed(text: str, dim: int = 384) -> List[float]:
    """Instant hash-based term vector generator for offline/fast embedding."""
    words = re.findall(r"\w+", text.lower())
    vec = np.zeros(dim, dtype=np.float32)
    for word in words:
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if (h % 2 == 0) else -1.0
        vec[idx] += sign
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


def get_embedding_model():
    """Lazy-load the SentenceTransformer model with fallback."""
    global _embedding_model, _use_fallback_embeddings
    if _use_fallback_embeddings:
        return None
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            from django.conf import settings
            model_name = getattr(settings, "EMBEDDING_MODEL", "all-MiniLM-L6-v2")
            logger.info(f"Loading embedding model: {model_name}")
            _embedding_model = SentenceTransformer(model_name)
            logger.info("Embedding model loaded successfully.")
        except Exception as e:
            logger.warning(f"SentenceTransformer load failed ({e}); switching to fast fallback embeddings.")
            _use_fallback_embeddings = True
            return None
    return _embedding_model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate normalized embeddings for a list of texts."""
    model = get_embedding_model()
    if model is None:
        return [_fallback_embed(t) for t in texts]

    try:
        embeddings = model.encode(
            texts,
            batch_size=32,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return embeddings.tolist()
    except Exception as e:
        logger.warning(f"Model encode failed ({e}); using fallback embeddings.")
        return [_fallback_embed(t) for t in texts]


def embed_query(query: str) -> List[float]:
    """Embed a single query string for similarity search."""
    return embed_texts([query])[0]
