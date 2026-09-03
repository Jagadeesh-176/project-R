"""
Shared setup for the two external things this app talks to:
  - the Gemini API (via google-genai)
  - the local Chroma vector database

Centralizing this means the CLI scripts (ingest.py, query.py) and the web API
(server.py) all get the exact same client setup instead of duplicating it.
"""
import sys

import chromadb
from google import genai

from src import config

_genai_client = None
_chroma_client = None


def require_api_key():
    if not config.GOOGLE_API_KEY:
        sys.exit(
            "Missing GOOGLE_API_KEY.\n"
            "Copy backend/.env.example to backend/.env and paste your key from "
            "https://aistudio.google.com/apikey into it."
        )


def get_genai_client():
    """Return a single shared Gemini API client (created on first use)."""
    global _genai_client
    if _genai_client is None:
        require_api_key()
        _genai_client = genai.Client(api_key=config.GOOGLE_API_KEY)
    return _genai_client


def get_chroma_client():
    """Return a single shared Chroma client, persisted to disk."""
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=config.CHROMA_DIR)
    return _chroma_client


def get_collection(create_if_missing=True):
    """Return the Chroma collection that holds our document chunks."""
    chroma_client = get_chroma_client()
    if create_if_missing:
        return chroma_client.get_or_create_collection(config.COLLECTION_NAME)
    return chroma_client.get_collection(config.COLLECTION_NAME)
