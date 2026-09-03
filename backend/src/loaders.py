"""
Turns an uploaded file's raw bytes into plain text, based on its extension.

This is the one place that knows about file formats — everything downstream
(chunking, embedding) only ever deals with plain strings, regardless of
whether the original was a .txt, .pdf, or .docx file.
"""
import io

from docx import Document
from pypdf import PdfReader

SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf", ".docx"}


def extract_text(filename, raw_bytes):
    """Dispatch to the right parser based on the file's extension."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext in (".txt", ".md"):
        return raw_bytes.decode("utf-8", errors="replace")

    if ext == ".pdf":
        return _extract_pdf(raw_bytes)

    if ext == ".docx":
        return _extract_docx(raw_bytes)

    raise ValueError(
        f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
    )


def _extract_pdf(raw_bytes):
    reader = PdfReader(io.BytesIO(raw_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(pages)


def _extract_docx(raw_bytes):
    document = Document(io.BytesIO(raw_bytes))
    paragraphs = [p.text for p in document.paragraphs]
    return "\n".join(paragraphs)
