"""
RETRIEVAL + GENERATION — Step 2 of the RAG pipeline: answer a question using
the knowledge base built by ingest.py.

For every question:
  1. RETRIEVE: embed the question with the same embedding model used during
     ingestion, then ask Chroma for the chunks whose vectors are closest to
     it (closest = most semantically similar)
  2. AUGMENT:  stuff those retrieved chunks into a prompt template, right
     alongside the question
  3. GENERATE: send that augmented prompt to a Gemini chat model, which
     writes an answer grounded in the retrieved text instead of relying only
     on what it memorized during training

This module has no CLI or web framework code in it on purpose — query.py
(terminal) and server.py (web API) both call into it, so the actual RAG logic
only exists in one place.
"""
import time

from google.genai import errors as genai_errors
from google.genai import types

from src import config
from src.clients import get_collection, get_genai_client

PROMPT_TEMPLATE = """You are a helpful assistant. Answer the question using ONLY the
context below. If the answer isn't contained in the context, say you don't
know instead of guessing.

Context:
{context}

Question: {question}

Answer:"""


def retrieve(question, top_k=None):
    """Embed the question and fetch the top_k most similar chunks.

    Returns a list of dicts: {text, source, chunk_index, distance}.
    """
    top_k = top_k or config.TOP_K
    genai_client = get_genai_client()
    collection = get_collection(create_if_missing=False)

    query_embedding = (
        genai_client.models.embed_content(
            model=config.EMBEDDING_MODEL,
            contents=[question],
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
        )
        .embeddings[0]
        .values
    )

    results = collection.query(query_embeddings=[query_embedding], n_results=top_k)
    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    return [
        {
            "text": text,
            "source": meta["source"],
            "chunk_index": meta["chunk_index"],
            "distance": distance,
        }
        for text, meta, distance in zip(documents, metadatas, distances)
    ]


def _generate_with_retry(genai_client, prompt, attempts=3):
    """Call generate_content, retrying on transient "model overloaded" errors.

    The free tier occasionally returns a 503 UNAVAILABLE when Google's
    servers are under heavy load. It usually succeeds a few seconds later,
    so a short retry-with-backoff avoids surfacing a scary error for
    something that isn't actually a bug in this app.
    """
    last_error = None
    for attempt in range(attempts):
        try:
            return genai_client.models.generate_content(
                model=config.GENERATION_MODEL,
                contents=prompt,
            )
        except genai_errors.ServerError as exc:
            last_error = exc
            time.sleep(2**attempt)  # 1s, 2s, 4s
    raise last_error


def answer_question(question, top_k=None):
    """Run the full retrieve -> augment -> generate pipeline for one question.

    Returns {"answer": str, "sources": [ {source, chunk_index, distance, preview} ]}.
    """
    retrieved = retrieve(question, top_k)

    context = "\n\n---\n\n".join(item["text"] for item in retrieved)
    prompt = PROMPT_TEMPLATE.format(context=context, question=question)

    genai_client = get_genai_client()
    response = _generate_with_retry(genai_client, prompt)

    sources = [
        {
            "source": item["source"],
            "chunk_index": item["chunk_index"],
            "distance": item["distance"],
            "preview": item["text"][:160].replace("\n", " "),
        }
        for item in retrieved
    ]

    return {"answer": response.text, "sources": sources}
