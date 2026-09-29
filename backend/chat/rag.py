"""
chat/rag.py
===========
Executive RAG Query Engine & Professional AI Personal Assistant.
"""
import logging
import requests
import re
import numpy as np
from django.conf import settings

logger = logging.getLogger(__name__)

TOP_K = 5
MIN_SIMILARITY_THRESHOLD = 0.20

MONTH_MAP = {
    "jan": "January", "january": "January",
    "feb": "February", "february": "February",
    "mar": "March", "march": "March",
    "apr": "April", "april": "April",
    "may": "May",
    "jun": "June", "june": "June",
    "jul": "July", "july": "July",
    "aug": "August", "august": "August",
    "sep": "September", "september": "September",
    "oct": "October", "october": "October",
    "nov": "November", "november": "November",
    "dec": "December", "december": "December"
}


def run_rag_query(user, question: str) -> dict:
    """
    Full RAG pipeline for a single user question.
    """
    from core.permissions import get_accessible_chunk_queryset
    from documents.ingestion import embed_query
    from .models import ChatLog

    try:
        query_embedding = embed_query(question)
    except Exception as e:
        logger.error(f"Failed to embed query: {e}")
        return _no_info_response(user, question, error=f"Embedding error: {e}")

    accessible_chunks = get_accessible_chunk_queryset(user)

    try:
        top_chunks = _get_top_chunks(accessible_chunks, query_embedding, question=question, top_k=TOP_K)
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return _no_info_response(user, question, error=f"Vector search error: {e}")

    if not top_chunks:
        logger.info(f"No relevant chunks found for user {user.username}: '{question[:60]}'")
        return _no_info_response(user, question)

    context_pieces = [f"[Source: {c.document.title}]\n{c.content}" for c in top_chunks]
    context = "\n\n---\n\n".join(context_pieces)
    prompt = _build_prompt(question, context)

    try:
        answer = _call_ollama(prompt)
    except Exception as e:
        logger.info(f"Ollama local LLM offline ({e}); running Executive Assistant Engine.")
        answer = _generate_executive_assistant_answer(top_chunks, question, accessible_chunks)

    source_doc_ids = list({chunk.document.id for chunk in top_chunks})
    source_chunk_ids = [chunk.id for chunk in top_chunks]

    ChatLog.objects.create(
        user=user,
        question=question,
        answer=answer,
        source_document_ids=source_doc_ids,
        source_chunk_ids=source_chunk_ids,
        chunks_retrieved=len(top_chunks),
        was_out_of_scope=False,
    )

    source_documents = []
    seen_doc_ids = set()
    for chunk in top_chunks:
        if chunk.document.id not in seen_doc_ids:
            source_documents.append({
                "id": chunk.document.id,
                "title": chunk.document.title,
            })
            seen_doc_ids.add(chunk.document.id)

    return {
        "answer": answer,
        "source_documents": source_documents,
        "source_chunk_ids": source_chunk_ids,
        "chunks_retrieved": len(top_chunks),
        "was_out_of_scope": False,
    }


def _parse_date_from_question(question: str):
    match = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?", question, re.IGNORECASE)
    if match:
        day = int(match.group(1))
        month_raw = match.group(2).lower()
        year = match.group(3) or "2026"
        month_name = MONTH_MAP.get(month_raw)
        if month_name:
            return day, month_name, year
    return None, None, None


def _parse_month_from_question(question: str):
    q_lower = question.lower()
    for m_key, m_name in MONTH_MAP.items():
        if re.search(r'\b' + m_key + r'\b', q_lower):
            return m_name
    return None


def _clean_task_description(task: str) -> str:
    """Clean signature lines, supervisor info, and trailing day names."""
    task = re.sub(r"Hariza Binti Sazali.*$", "", task, flags=re.IGNORECASE)
    task = re.sub(r"Supervisor's name.*$", "", task, flags=re.IGNORECASE)
    task = re.sub(r"Position\s*\|.*$", "", task, flags=re.IGNORECASE)
    task = re.sub(r"DDate.*$", "", task, flags=re.IGNORECASE)
    task = re.sub(r"(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|\s*Date:\s*\d{1,2}\s+[A-Za-z]+.*)+$", "", task, flags=re.IGNORECASE)
    task = re.sub(r"--- Slide \d+ ---", "", task)
    task = re.sub(r"\s*\|\s*", " ", task)
    return task.strip()


def _generate_executive_assistant_answer(top_chunks, question: str, accessible_chunks) -> str:
    day, month, year = _parse_date_from_question(question)
    target_month = month or _parse_month_from_question(question)
    q_lower = question.lower()

    # ── CASE A1: Exact Day Query (e.g. "15 April") ─────────────────────────
    if day and target_month:
        all_chunks = list(accessible_chunks.select_related("document"))
        combined_text = "\n".join([c.content for c in all_chunks])

        date_regex = rf"(?:Date:\s*{day}\s+{target_month}\s+{year}\s*\|\s*)(.*?)(?=(?:(?:MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY)?\s*Date:\s*\d{{1,2}}\s+[A-Za-z]+\s+\d{{4}})|Supervisor's name|Signature|---|$)"
        match = re.search(date_regex, combined_text, re.IGNORECASE | re.DOTALL)

        if match:
            task = _clean_task_description(match.group(1))
            if len(task) > 10:
                return f"### 📋 Task Completed on {day} {target_month} {year}\n\n• **Description**: {task}"

        month_pattern = rf"(?:Date:\s*(\d{{1,2}})\s+{target_month}\s+{year}\s*\|\s*)([^|\n]+)"
        entries = []
        for m in re.finditer(month_pattern, combined_text, re.IGNORECASE):
            d_val = int(m.group(1))
            task_val = _clean_task_description(m.group(2))
            if len(task_val) > 15:
                entries.append((abs(d_val - day), d_val, task_val))

        entries.sort(key=lambda x: x[0])

        if entries:
            res = [f"**No entry recorded for {day} {target_month} {year}** (Weekend / Non-working day).\n\n### 📌 Nearest Logbook Entries:"]
            seen_days = set()
            for diff, d_val, task_val in entries[:2]:
                if d_val not in seen_days:
                    res.append(f"• **{d_val} {target_month} {year}**: {task_val}")
                    seen_days.add(d_val)
            return "\n\n".join(res)

    # ── CASE A2: Month Summary Query (e.g. "what i did in april", "may progress") ──
    if target_month and not day:
        month_lower = target_month.lower()
        extracted_sections = []

        for chunk in top_chunks:
            content = chunk.content
            if month_lower in content.lower() or f"month" in content.lower():
                lines = content.split("\n")
                capturing = False
                captured_lines = []

                for line in lines:
                    line_clean = line.strip()
                    if not line_clean:
                        continue

                    # Start capturing when we hit the target month header
                    if month_lower in line_clean.lower() or (month_lower in content.lower() and "month" in line_clean.lower()):
                        capturing = True

                    if capturing:
                        # Stop capturing if we encounter a different month section
                        if any(m.lower() in line_clean.lower() for m in MONTH_MAP.values() if m.lower() != month_lower and "month 2" in line_clean.lower()):
                            break

                        cleaned_l = _clean_task_description(line_clean)
                        if cleaned_l and not cleaned_l.startswith("---") and len(cleaned_l) > 5:
                            captured_lines.append(cleaned_l)

                if captured_lines:
                    formatted_items = []
                    for l in captured_lines[:15]:
                        if "WHAT I WORKED ON" in l.upper():
                            formatted_items.append("\n**🛠️ What I Worked On**:")
                        elif "WHAT I LEARNED" in l.upper():
                            formatted_items.append("\n**💡 What I Learned**:")
                        elif "MONTH" in l.upper() or "PROGRESSION" in l.upper() or "OVERVIEW" in l.upper():
                            formatted_items.append(f"### 🗓️ {l}")
                        else:
                            formatted_items.append(f"• {l}")

                    if formatted_items:
                        extracted_sections.append("\n".join(formatted_items))

        if extracted_sections:
            return f"### 📌 Internship Activities & Accomplishments — {target_month} 2026\n\n" + "\n\n".join(extracted_sections[:2])

    # ── CASE B: Supervisor / Contact / Metadata Query ────────────────────
    if any(k in q_lower for k in ["supervisor", "contact", "email", "manager", "author", "phone"]):
        metadata_items = []
        seen = set()
        for chunk in top_chunks:
            lines = chunk.content.split("\n")
            for line in lines:
                if "|" in line:
                    parts = [p.strip() for p in line.split("|") if p.strip()]
                    i = 0
                    while i < len(parts) - 1:
                        k, v = parts[i], parts[i + 1]
                        k_clean = k.replace("Supervisor's name", "Supervisor Name").rstrip(":").strip()
                        if any(target in k_clean.lower() for target in ["supervisor", "position", "contact", "email", "department", "manager", "author", "phone"]):
                            if k_clean.lower() not in seen and len(v) > 2:
                                metadata_items.append(f"• **{k_clean}**: {v}")
                                seen.add(k_clean.lower())
                        i += 2
                elif ":" in line:
                    parts = line.split(":", 1)
                    k, v = parts[0].strip(), parts[1].strip()
                    if any(target in k.lower() for target in ["supervisor", "position", "contact", "email", "department", "manager", "author", "phone"]):
                        if k.lower() not in seen and len(v) > 2:
                            metadata_items.append(f"• **{k}**: {v}")
                            seen.add(k.lower())

        if metadata_items:
            return "### 👤 Contact & Key Information\n\n" + "\n".join(metadata_items)

    # ── CASE C: Executive Multi-chunk Summary (Claude/Gemini Style) ────────
    sections = []
    seen_headers = set()

    for chunk in top_chunks[:3]:
        text = chunk.content
        cleaned = _clean_task_description(text)
        lines = [l.strip() for l in cleaned.split("\n") if l.strip() and len(l.strip()) > 15]

        doc_title = chunk.document.title
        key_lines = []

        for line in lines:
            if not line.startswith("---") and not line.lower().startswith("guidelines"):
                line_key = line[:40].lower()
                if line_key not in seen_headers:
                    key_lines.append(f"• {line}")
                    seen_headers.add(line_key)

        if key_lines:
            sections.append(f"#### 📄 Source: {doc_title}\n" + "\n".join(key_lines[:5]))

    if sections:
        return "### 💡 Key Information\n\n" + "\n\n".join(sections)

    summary_text = _clean_task_description(top_chunks[0].content)[:300]
    return f"### 💡 Summary\n\n{summary_text}"


def _get_top_chunks(accessible_chunks, query_embedding, question: str = "", top_k=TOP_K, min_sim_threshold=MIN_SIMILARITY_THRESHOLD):
    chunks = list(accessible_chunks.select_related("document"))
    if not chunks:
        return []

    q_vec = np.array(query_embedding, dtype=np.float32)
    norm_q = np.linalg.norm(q_vec)
    if norm_q > 0:
        q_vec = q_vec / norm_q

    day, month, _ = _parse_date_from_question(question)
    target_month = month or _parse_month_from_question(question)
    q_lower = question.lower()

    # Dynamic threshold: lower threshold if specific domain keywords exist
    has_domain_keyword = any(k in q_lower for k in ["april", "may", "june", "july", "internship", "presentation", "slide", "logbook", "task", "worked", "did", "accomplished"])
    effective_min_threshold = 0.05 if has_domain_keyword else min_sim_threshold

    scored_chunks = []
    for chunk in chunks:
        emb = chunk.embedding
        if not emb:
            continue
        c_vec = np.array(emb, dtype=np.float32)
        norm_c = np.linalg.norm(c_vec)
        if norm_c > 0:
            c_vec = c_vec / norm_c

        sim = float(np.dot(q_vec, c_vec))
        content_lower = chunk.content.lower()
        doc_title_lower = chunk.document.title.lower()

        # Month similarity boost
        if target_month:
            t_month_lower = target_month.lower()
            if t_month_lower in content_lower or t_month_lower in doc_title_lower:
                sim += 0.45
            elif "month 1" in content_lower and t_month_lower == "april":
                sim += 0.45
            elif "month 2" in content_lower and t_month_lower == "may":
                sim += 0.45
            elif "month 3" in content_lower and t_month_lower in ("june", "july"):
                sim += 0.45

        if day and month:
            date_pattern = f"{day} {month}".lower()
            if date_pattern in content_lower:
                sim += 0.50

        if any(w in q_lower for w in ["logbook", "task", "done", "did", "do on", "supervisor", "internship", "presentation", "slide"]):
            if any(k in doc_title_lower for k in ["logbook", "internship", "presentation", "slide"]):
                sim += 0.30

        if sim >= effective_min_threshold:
            scored_chunks.append((sim, chunk))

    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    return [chunk for sim, chunk in scored_chunks[:top_k]]




def _build_prompt(question: str, context: str) -> str:
    return (
        "You are ALIIS, an executive AI assistant. "
        "Answer the user's question directly, concisely, and professionally based ONLY on the context below.\n\n"
        f"CONTEXT:\n{context}\n\n"
        f"QUESTION: {question}\n\n"
        "ANSWER:"
    )


def _call_ollama(prompt: str) -> str:
    url = getattr(settings, "OLLAMA_URL", "http://localhost:11434/api/generate")
    model = getattr(settings, "OLLAMA_MODEL", "qwen2.5:3b")

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "top_p": 0.9,
        },
    }

    response = requests.post(url, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    return data.get("response", "").strip()


def _no_info_response(user, question: str, error: str = None) -> dict:
    from .models import ChatLog

    answer = (
        "I don't have information on that topic in the documents accessible to your group."
    )

    ChatLog.objects.create(
        user=user,
        question=question,
        answer=answer,
        source_document_ids=[],
        source_chunk_ids=[],
        chunks_retrieved=0,
        was_out_of_scope=True,
    )

    return {
        "answer": answer,
        "source_documents": [],
        "source_chunk_ids": [],
        "chunks_retrieved": 0,
        "was_out_of_scope": True,
    }
