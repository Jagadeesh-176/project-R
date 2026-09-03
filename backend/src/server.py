"""
Web API for the RAG app — this is what the React frontend talks to.

It's a thin HTTP wrapper around src/rag.py and src/ingest.py: it doesn't
contain any RAG logic itself, just request/response handling.

Run with:
    py -m uvicorn src.server:app --reload --host 0.0.0.0 --port 8000

--host 0.0.0.0 makes it reachable from other devices on your Wi-Fi (e.g. your
phone), not just from this PC. See the README for testing on a phone.

Once running, interactive API docs are auto-generated at:
    http://localhost:8000/docs
"""
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google.genai import errors as genai_errors
from pydantic import BaseModel

from src.clients import get_collection, require_api_key
from src.ingest import (
    clear_uploads,
    ingest_uploaded_file,
    list_documents,
    remove_document,
    run_ingest,
)
from src.rag import answer_question

app = FastAPI(title="RAG Demo API")

# Allow the React dev server (and any device on your network, for phone
# testing) to call this API. Fine for a local learning project; a real
# deployment should restrict this to your actual frontend's origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str
    top_k: int | None = None


class SourceItem(BaseModel):
    source: str
    chunk_index: int
    distance: float
    preview: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceItem]


class IngestResponse(BaseModel):
    documents: int
    chunks: int
    reset: bool


class DocumentItem(BaseModel):
    filename: str
    chunks: int
    is_sample: bool


class UploadResponse(BaseModel):
    filename: str
    chunks: int


class RemoveResponse(BaseModel):
    filename: str
    removed: bool


class ClearUploadsResponse(BaseModel):
    removed: list[str]
    count: int


@app.on_event("startup")
def startup():
    # Fail fast with a clear message rather than a confusing error on the
    # first request if the API key was never set up.
    require_api_key()

    # Auto-build the index if it's empty. This matters most on free-tier
    # hosts (e.g. Render's free plan) whose local disk doesn't persist
    # between deploys/restarts — without this, every cold start would come
    # up with zero vectors until someone manually hit /api/ingest. Since the
    # sample knowledge base is tiny, re-ingesting on startup costs a few
    # seconds and keeps the app working out of the box on any host.
    try:
        collection = get_collection(create_if_missing=True)
        if collection.count() == 0:
            run_ingest(reset=False)
    except Exception as exc:
        print(f"Warning: startup auto-ingest failed: {exc}")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/query", response_model=QueryResponse)
def query(payload: QueryRequest):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="question must not be empty")

    try:
        return answer_question(question, top_k=payload.top_k)
    except genai_errors.ServerError:
        # Gemini's own servers are temporarily overloaded (this is already
        # retried a few times inside rag.py before giving up). 503 tells the
        # frontend this is transient and worth trying again shortly.
        raise HTTPException(
            status_code=503,
            detail="The AI model is temporarily busy. Please try again in a few seconds.",
        )
    except Exception as exc:
        # Most commonly: no vector store built yet. Surface a clear message
        # to the UI instead of a generic 500.
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/ingest", response_model=IngestResponse)
def ingest(reset: bool = False):
    try:
        return run_ingest(reset=reset)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/documents", response_model=list[DocumentItem])
def documents():
    return list_documents()


@app.post("/api/upload", response_model=UploadResponse)
async def upload(file: UploadFile):
    raw_bytes = await file.read()
    try:
        return ingest_uploaded_file(file.filename, raw_bytes)
    except ValueError as exc:
        # Bad input: wrong file type, too large, empty/unreadable — the
        # user can fix these themselves, so 400 rather than 500.
        raise HTTPException(status_code=400, detail=str(exc))
    except genai_errors.ServerError:
        raise HTTPException(
            status_code=503,
            detail="The AI model is temporarily busy. Please try uploading again in a few seconds.",
        )


@app.delete("/api/documents", response_model=ClearUploadsResponse)
def clear_all_uploads():
    return clear_uploads()


@app.delete("/api/documents/{filename}", response_model=RemoveResponse)
def delete_document(filename: str):
    try:
        return remove_document(filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
