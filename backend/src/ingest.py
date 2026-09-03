"""
INGESTION — Step 1 of the RAG pipeline: build the searchable knowledge base.

Three ways documents get into the vector store:
  1. run_ingest() — bulk (re)build from every file in data/sample_docs/ (the
     bundled demo docs, tracked in git) plus data/uploads/ (whatever's been
     uploaded so far). Used at server startup and by the CLI.
  2. ingest_uploaded_file() — incrementally add ONE newly uploaded file
     without re-processing everything else. Used by POST /api/upload.
  3. remove_document() — the reverse: drop one document's chunks. Used by
     DELETE /api/documents/{filename}.

Every path funnels through the same steps: extract text -> chunk -> embed ->
upsert into Chroma. See src/loaders.py for step 1 (per file type) and
src/chunking.py for step 2.

Run the CLI with:
    py -m src.ingest
    py -m src.ingest --reset      (wipes the existing database first)
"""
import glob
import os
import sys

from google.genai import types

from src import config
from src.chunking import chunk_text
from src.clients import get_chroma_client, get_genai_client
from src.loaders import extract_text


def load_sample_docs():
    """Read every .txt file in data/sample_docs/. Returns [(filename, text)]."""
    docs = []
    for path in sorted(glob.glob(os.path.join(config.DATA_DIR, "*.txt"))):
        with open(path, "r", encoding="utf-8") as f:
            docs.append((os.path.basename(path), f.read()))
    return docs


def load_uploaded_docs():
    """Read + extract text from every file in data/uploads/. Returns [(filename, text)]."""
    docs = []
    if not os.path.isdir(config.UPLOADS_DIR):
        return docs
    for path in sorted(glob.glob(os.path.join(config.UPLOADS_DIR, "*"))):
        filename = os.path.basename(path)
        with open(path, "rb") as f:
            raw_bytes = f.read()
        try:
            docs.append((filename, extract_text(filename, raw_bytes)))
        except ValueError:
            continue  # skip anything that isn't a supported document type
    return docs


def is_sample_doc(filename):
    return os.path.isfile(os.path.join(config.DATA_DIR, filename))


def embed_texts(client, texts, task_type):
    """Call Gemini's embedding model on a batch of texts.

    task_type tells the embedding model whether it's embedding something to
    be SEARCHED (a document going into the index) or something DOING the
    searching (a user's question) — Gemini's embedding model optimizes the
    vector slightly differently for each, which improves retrieval quality.
    """
    result = client.models.embed_content(
        model=config.EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return [e.values for e in result.embeddings]


def _chunk_and_embed(genai_client, filename, text):
    """Shared step: text -> chunks -> ids/metadatas -> embeddings."""
    chunks = chunk_text(text, config.CHUNK_SIZE, config.CHUNK_OVERLAP)
    ids = [f"{filename}::chunk-{i}" for i in range(len(chunks))]
    metadatas = [{"source": filename, "chunk_index": i} for i in range(len(chunks))]

    # Embed in small batches rather than all at once, to stay comfortably
    # under the API's per-request limits.
    batch_size = 20
    embeddings = []
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        embeddings.extend(embed_texts(genai_client, batch, "RETRIEVAL_DOCUMENT"))

    return chunks, ids, metadatas, embeddings


def run_ingest(reset=False):
    """Build (or rebuild) the vector store from sample docs + uploads on disk.

    Note: on hosts with no persistent disk (e.g. Render's free tier), only
    data/sample_docs/ survives a cold start — it's bundled in the git repo.
    data/uploads/ is NOT tracked in git, so previously uploaded documents
    won't reappear after a restart there. Locally, both persist normally.
    """
    chroma_client = get_chroma_client()

    if reset:
        try:
            chroma_client.delete_collection(config.COLLECTION_NAME)
        except Exception:
            pass  # collection didn't exist yet — nothing to clear

    collection = chroma_client.get_or_create_collection(config.COLLECTION_NAME)

    docs = load_sample_docs() + load_uploaded_docs()
    if not docs:
        raise RuntimeError(f"No documents found in {config.DATA_DIR} or {config.UPLOADS_DIR}")

    genai_client = get_genai_client()

    all_chunks, all_ids, all_metadatas, all_embeddings = [], [], [], []
    for filename, text in docs:
        chunks, ids, metadatas, embeddings = _chunk_and_embed(genai_client, filename, text)
        all_chunks += chunks
        all_ids += ids
        all_metadatas += metadatas
        all_embeddings += embeddings

    collection.upsert(
        ids=all_ids,
        embeddings=all_embeddings,
        documents=all_chunks,
        metadatas=all_metadatas,
    )

    return {
        "documents": len(docs),
        "chunks": len(all_chunks),
        "reset": reset,
    }


def ingest_uploaded_file(filename, raw_bytes):
    """Add (or replace) ONE uploaded document without touching the rest.

    Re-uploading the same filename replaces its previous chunks, so uploads
    are idempotent rather than accumulating duplicates.
    """
    if len(raw_bytes) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise ValueError(f"File exceeds the {config.MAX_UPLOAD_MB}MB upload limit")

    text = extract_text(filename, raw_bytes)  # raises ValueError for unsupported types
    if not text.strip():
        raise ValueError("No extractable text found in this file")

    os.makedirs(config.UPLOADS_DIR, exist_ok=True)
    with open(os.path.join(config.UPLOADS_DIR, filename), "wb") as f:
        f.write(raw_bytes)

    genai_client = get_genai_client()
    collection = get_chroma_client().get_or_create_collection(config.COLLECTION_NAME)

    # Drop any chunks from a previous upload of this same filename first.
    try:
        collection.delete(where={"source": filename})
    except Exception:
        pass

    chunks, ids, metadatas, embeddings = _chunk_and_embed(genai_client, filename, text)
    collection.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)

    return {"filename": filename, "chunks": len(chunks)}


def list_documents():
    """List every document currently indexed, with its chunk count."""
    collection = get_chroma_client().get_or_create_collection(config.COLLECTION_NAME)
    result = collection.get(include=["metadatas"])

    counts = {}
    for meta in result["metadatas"]:
        counts[meta["source"]] = counts.get(meta["source"], 0) + 1

    docs = [
        {"filename": filename, "chunks": count, "is_sample": is_sample_doc(filename)}
        for filename, count in counts.items()
    ]
    return sorted(docs, key=lambda d: (not d["is_sample"], d["filename"]))


def remove_document(filename):
    """Remove one uploaded document's chunks (and its file). Sample docs are protected."""
    if is_sample_doc(filename):
        raise ValueError("Can't remove a built-in sample document")

    collection = get_chroma_client().get_or_create_collection(config.COLLECTION_NAME)
    collection.delete(where={"source": filename})

    upload_path = os.path.join(config.UPLOADS_DIR, filename)
    if os.path.isfile(upload_path):
        os.remove(upload_path)

    return {"filename": filename, "removed": True}


def clear_uploads():
    """Remove every uploaded document (chunks + files), leaving sample docs untouched.

    This is the "start over with just the demo content" button — it answers
    the question "what happens to old indexed content?": nothing lingers
    silently. Each upload either replaces its own prior chunks (same
    filename) or stacks alongside others (different filename) until you
    explicitly clear it here, so there's no hidden stale-index buildup.
    """
    removed = []
    for doc in list_documents():
        if not doc["is_sample"]:
            remove_document(doc["filename"])
            removed.append(doc["filename"])
    return {"removed": removed, "count": len(removed)}


def main():
    from src.clients import require_api_key

    require_api_key()
    reset = "--reset" in sys.argv

    print("Requesting embeddings from Gemini and building the index...")
    summary = run_ingest(reset=reset)
    print(
        f"\nDone. Loaded {summary['documents']} document(s) -> "
        f"stored {summary['chunks']} chunk(s) in '{config.CHROMA_DIR}'."
    )
    print("Now run:  py -m src.query   (or start the API server, see README)")


if __name__ == "__main__":
    main()
