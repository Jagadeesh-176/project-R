"""
INGESTION — Step 1 of the RAG pipeline: build the searchable knowledge base.

What run_ingest() does, in order:
  1. Reads every .txt file in data/sample_docs/
  2. Splits each file into small overlapping chunks (see src/chunking.py)
  3. Sends the chunks to Gemini's embedding model, which turns each chunk of
     text into a vector (a list of a few thousand numbers) that captures its
     meaning
  4. Stores those vectors (plus the original text, so we can show it later)
     in a local Chroma vector database on disk

This logic is called from two places:
  - the CLI below (py -m src.ingest), for terminal use
  - server.py's POST /api/ingest endpoint, so the React UI can trigger it too

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


def load_documents(data_dir):
    """Read every .txt file in data_dir. Returns a list of (filename, text)."""
    docs = []
    for path in sorted(glob.glob(os.path.join(data_dir, "*.txt"))):
        with open(path, "r", encoding="utf-8") as f:
            docs.append((os.path.basename(path), f.read()))
    return docs


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


def run_ingest(reset=False):
    """Build (or rebuild) the vector store. Returns a small summary dict."""
    chroma_client = get_chroma_client()

    if reset:
        try:
            chroma_client.delete_collection(config.COLLECTION_NAME)
        except Exception:
            pass  # collection didn't exist yet — nothing to clear

    collection = chroma_client.get_or_create_collection(config.COLLECTION_NAME)

    docs = load_documents(config.DATA_DIR)
    if not docs:
        raise RuntimeError(f"No .txt files found in {config.DATA_DIR}")

    genai_client = get_genai_client()

    all_chunks, all_ids, all_metadatas = [], [], []
    for filename, text in docs:
        chunks = chunk_text(text, config.CHUNK_SIZE, config.CHUNK_OVERLAP)
        for i, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            all_ids.append(f"{filename}::chunk-{i}")
            all_metadatas.append({"source": filename, "chunk_index": i})

    # Embed in small batches rather than all at once, to stay comfortably
    # under the API's per-request limits.
    batch_size = 20
    all_embeddings = []
    for i in range(0, len(all_chunks), batch_size):
        batch = all_chunks[i : i + batch_size]
        all_embeddings.extend(embed_texts(genai_client, batch, "RETRIEVAL_DOCUMENT"))

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
