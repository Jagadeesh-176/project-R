"""
Splitting long documents into small, overlapping pieces ("chunks").

Why chunk at all?
- Embedding models work best on focused pieces of text, not whole documents.
- Retrieval is more precise when each stored piece is about ONE topic instead
  of an entire multi-topic file.
- The LLM's context window is limited, so you can only afford to hand it a
  handful of small chunks per question, not every document in full.

The overlap exists so that a sentence sitting right on a chunk boundary
doesn't get split in a way that loses its meaning — the tail of one chunk
reappears as the head of the next.
"""


def chunk_text(text, chunk_size=800, chunk_overlap=100):
    """Split `text` into a list of overlapping substrings.

    chunk_size:    target length of each chunk, in characters.
    chunk_overlap: how many characters of overlap between consecutive chunks.
    """
    if chunk_overlap >= chunk_size:
        raise ValueError("chunk_overlap must be smaller than chunk_size")

    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = start + chunk_size
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        start += chunk_size - chunk_overlap

    return chunks
