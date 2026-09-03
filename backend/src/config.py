"""
Central place for every tunable setting in this RAG app.

Nothing "magic" happens here — it's just constants pulled out of the other
files so you have one place to look when you want to experiment (e.g. change
chunk size, swap models, retrieve more/fewer chunks).
"""
import os

from dotenv import load_dotenv

# Reads the .env file in the project root and loads it into environment
# variables, so os.getenv("GOOGLE_API_KEY") below can find it.
load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# --- Models ---
# Both are Google Gemini models, called through the same API key.
# Full current model list: https://ai.google.dev/gemini-api/docs/models
EMBEDDING_MODEL = "gemini-embedding-001"  # turns text into vectors
# "-latest" is an alias Google keeps pointed at their current recommended
# fast model, so this doesn't break every time a dated model gets retired.
GENERATION_MODEL = "gemini-flash-latest"  # turns (context + question) into an answer

# --- Chunking ---
# Documents are split into overlapping windows of characters before being
# embedded. Smaller chunks = more precise retrieval but less surrounding
# context per chunk; bigger chunks = more context but less precise matches.
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# --- Retrieval ---
# How many chunks to pull back from the vector store per question.
TOP_K = 4

# --- Storage locations ---
DATA_DIR = "data/sample_docs"   # bundled demo documents (tracked in git)
UPLOADS_DIR = "data/uploads"    # user-uploaded documents (NOT tracked in git)
CHROMA_DIR = "chroma_db"        # where the local vector database is persisted to disk
COLLECTION_NAME = "rag_docs"    # name of the collection inside that database

# --- Uploads ---
MAX_UPLOAD_MB = 15
