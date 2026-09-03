# RAG Studio Internals

How Retrieval-Augmented Generation actually works in this app, traced
through one real question. Every number and snippet below is real output
from this app, not a made-up example — see it rendered with diagrams at
[the published version](https://claude.ai/code/artifact/5d58d80e-243c-49a8-872e-fad8aa209c2c)
(or regenerate your own copy any time by asking Claude).

## The idea, in one line

An AI model only knows what it learned during training. RAG hands it a
small, relevant excerpt of *your* documents right before asking the
question, so it answers from that excerpt instead of guessing from memory.

```
INGESTION (once, ahead of time)
  product_faq.txt → Chunk → Embed → Chroma store

QUERY (every time you ask)
  Your question → Embed → Retrieve → Augment → Generate → Answer
                             ↑
                just searches the store ingestion built
```

## The running example

Document: `backend/data/sample_docs/product_faq.txt`, a fictional
smart-home FAQ. Question we trace end to end:

> **"How many devices can the Acme Home Hub support?"**

Gemini has never seen this fictional product — a correct answer can only
come from retrieval actually working.

## Part 1 — building the index (`src/ingest.py`)

**Step 1 — Chunk.** A whole document is too big and unfocused to search
well, so it's split into overlapping windows first (`CHUNK_SIZE=800`,
`CHUNK_OVERLAP=100`). Run for real, `product_faq.txt` (1,100 characters)
splits into exactly **2 chunks**: chunk #0 (799 chars) and chunk #1 (399
chars). Chunk #1 starts mid-word ("nternet") — that's the 100-character
overlap, so a sentence sitting on the boundary (the battery-backup
question) still appears whole in at least one chunk.

**Step 2 — Embed.** Each chunk goes to an embedding model, which converts
text into a list of numbers (a *vector*) representing its meaning. Similar
topics land as nearby vectors; unrelated topics land far apart.

```python
result = genai_client.models.embed_content(
    model="gemini-embedding-001",
    contents=[chunk_text],
    config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
)
vector = result.embeddings[0].values   # a few thousand floats
```

`task_type="RETRIEVAL_DOCUMENT"` tells the model this text is going *into*
the index — its counterpart, `RETRIEVAL_QUERY`, shows up in Part 2.

**Step 3 — Store.** The vector, the original text, and metadata (filename +
chunk number) go into **Chroma**, a vector database — concretely, a search
index built for one operation: "give me the K stored vectors closest to
this one."

```python
collection.upsert(
    ids=["product_faq.txt::chunk-0", "product_faq.txt::chunk-1"],
    embeddings=[vector_0, vector_1],
    documents=[chunk_0_text, chunk_1_text],
    metadatas=[{"source": "product_faq.txt", "chunk_index": 0},
               {"source": "product_faq.txt", "chunk_index": 1}],
)
```

## Part 2 — answering a question (`src/rag.py`)

**Step 1 — Embed the question.** Same model, but `task_type="RETRIEVAL_QUERY"`
this time — Gemini tunes the vector slightly differently depending on which
side of the search you're on.

**Step 2 — Retrieve.** Chroma compares the question's vector against every
stored chunk and returns the closest ones. The real result for this exact
question, `top_k=4`:

| Rank | Source chunk | Distance | |
|---|---|---|---|
| 1 | `product_faq.txt #0` | **0.411** | closest — has the actual answer |
| 2 | `product_faq.txt #1` | 0.579 | same doc, adjacent chunk |
| 3 | `project_apollo_notes.txt #0` | 0.745 | unrelated — pulled in anyway |
| 4 | `acme_handbook.txt #0` | 0.765 | unrelated — pulled in anyway |

**Distance is "how different two meanings are" — lower is more similar.**
Retrieval always returns exactly `top_k` results, even weak ones — nothing
here decides "close enough." That judgment happens one step later, when the
model reads the context and is told to say "I don't know" if the answer
genuinely isn't there.

**Step 3 — Augment.** The retrieved chunks get pasted into a prompt
template alongside the question:

```python
PROMPT_TEMPLATE = """You are a helpful assistant. Answer the question using ONLY the
context below. If the answer isn't contained in the context, say you don't
know instead of guessing.

Context:
{context}

Question: {question}

Answer:"""
```

This is the "**Augmented**" in Retrieval-Augmented Generation — the model
never sees your bare question, only your question plus four chunks of
ground truth stapled in front of it.

**Step 4 — Generate.** That block goes to `gemini-flash-latest`. Real reply:

> "A single Acme Home Hub supports up to 150 connected devices. If more are
> needed, two hubs can be paired using the 'Hub Mesh' feature."

Correct — and it could only know this by reading chunk #0, since Gemini was
never trained on a fictional product. That's grounding, working as intended.

**Step 5 — Back to the UI.** The backend bundles the answer with the four
sources into one JSON response; the frontend renders the answer as
Markdown and the sources as expandable citations.

## Why not just ask the AI directly?

Ask something *not* in any document ("What's the capital of France?") and
the prompt's instruction makes it refuse instead of guessing:

> "I don't know."

That refusal is the entire value of RAG. An AI asked something it can't
answer often **hallucinates** — invents a plausible-sounding wrong answer —
rather than admit uncertainty. Retrieval plus a strict prompt turns
"confidently wrong" into "correctly unsure."

## The whole app, file by file

| File | Job |
|---|---|
| `backend/src/chunking.py` | Splits text into overlapping windows |
| `backend/src/loaders.py` | Extracts text from `.txt`/`.pdf`/`.docx` uploads |
| `backend/src/clients.py` | Shared Gemini client + shared Chroma client |
| `backend/src/ingest.py` | Embed + store — the whole library or one upload |
| `backend/src/rag.py` | Retrieve, augment, generate — the actual RAG logic |
| `backend/src/server.py` | FastAPI — turns the above into HTTP endpoints |
| `backend/chroma_db/` | The vector index itself, as files on disk |
| `frontend/src/api.js` | Fetch wrapper — the only file that knows the backend URL |
| `frontend/src/App.jsx` | Chat state: messages, loading, the conversation |
| `frontend/src/components/*` | Sidebar (knowledge base), ChatMessage, Composer |

## Design decisions, and why

- **`CHUNK_SIZE=800`** — small enough for precise retrieval, large enough
  to keep a whole thought intact.
- **`OVERLAP=100`** — insurance against splitting a sentence exactly on a
  chunk boundary (see the real "nternet" example above).
- **`top_k=4`** — too few risks missing the answer; too many drowns the
  model in irrelevant text and costs more tokens.
- **Re-upload replaces** — `ingest_uploaded_file()` deletes a filename's
  old chunks before adding new ones, so no stale duplicates.
- **Sample docs are protected** — `remove_document()` refuses to delete
  anything in `data/sample_docs/`, since they're the worked examples this
  document (and the app's suggestion chips) rely on.
- **Auto-ingest on startup** — Render's free tier has no persistent disk;
  if the index comes up empty on a cold start, the server rebuilds it from
  the git-tracked sample docs automatically before serving any request.

## Glossary

| Term | Meaning |
|---|---|
| Embedding | A list of numbers representing a piece of text's meaning |
| Vector | The technical name for that list of numbers |
| Vector database | A store built for "find the K nearest vectors to this one" (Chroma, here) |
| Distance | How different two vectors are — lower means more similar |
| Chunk | One small, overlapping slice of a document — the unit actually searched |
| Token | The unit an LLM reads text in — roughly ¾ of a word |
| Context window | The max text a model can read in one call — why chunking/top-k exist |
| Prompt template | The fixed wrapper turning "context + question" into model instructions |
| Grounding | Answering from retrieved real text instead of memorized training data |
| Hallucination | A confident but fabricated answer, produced when a model guesses |
| Endpoint | One URL the backend responds to, e.g. `POST /api/query` |
