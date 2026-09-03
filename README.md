# RAG Demo — Personal Learning Project

A minimal, fully working **Retrieval-Augmented Generation (RAG)** application,
built to learn the fundamentals before extending it into something bigger.

- **Backend**: Python + FastAPI, using Google's Gemini API for embeddings and
  text generation, with a local Chroma vector database.
- **Frontend**: Plain React (Vite) — a sidebar + chat layout (collapses to a
  slide-over drawer on mobile) with 6 themes (System/Light/Dark/Ocean/
  Sunset/Forest), Markdown-rendered answers, and document upload built in.

## What is RAG, in one paragraph?

An LLM (like Gemini) only knows what it learned during training — it has no
idea about your personal documents, your company's internal notes, or
anything written after its training cutoff. **RAG fixes this by retrieving
relevant text from your own documents and pasting it into the prompt**, right
before asking the question. The model then answers using that pasted-in
context instead of guessing from memory. That's the whole idea — everything
else in this repo is plumbing to make that happen automatically.

This demo proves it with fictional documents in
[backend/data/sample_docs/](backend/data/sample_docs/) (a fake company
handbook, project notes, and a product FAQ) — Gemini has never seen these, so
correct answers can *only* come from retrieval.

## Architecture

```
┌─────────────────┐        HTTP (fetch)        ┌──────────────────────┐
│  React frontend  │ ─────────────────────────▶ │   FastAPI backend     │
│  (Vite, :5173)   │ ◀───────────────────────── │   (uvicorn, :8000)    │
└─────────────────┘        JSON answers         └──────────┬───────────┘
                                                            │
                                          ┌─────────────────┼─────────────────┐
                                          ▼                                   ▼
                                ┌───────────────────┐              ┌───────────────────┐
                                │  Chroma vector DB  │              │    Gemini API      │
                                │  (local, on disk)  │              │ (embeddings + chat) │
                                └───────────────────┘              └───────────────────┘
```

The frontend never talks to Gemini or Chroma directly — it only calls the
Python backend's HTTP API. All RAG logic lives in Python.

## Prerequisites

- **Python 3.10+** — you have 3.12.10 installed (via the `py` launcher; the
  bare `python` command on your PATH is currently the broken Windows Store
  stub, so every command below uses `py` or an activated venv instead).
- **Node.js + npm** — you have Node v24.19.0 / npm 10.8.2.
- **A free Google AI Studio API key** — https://aistudio.google.com/apikey
  (already set up in `backend/.env` for this project).

## Project structure

```
rag-app/
├── backend/
│   ├── .env                  # your real API key (git-ignored, never commit)
│   ├── .env.example          # template — safe to commit
│   ├── requirements.txt
│   ├── data/sample_docs/     # the "knowledge base" — swap in your own .txt files later
│   ├── chroma_db/            # vector database, created by ingest (git-ignored)
│   └── src/
│       ├── config.py         # every tunable setting lives here
│       ├── chunking.py       # splits documents into overlapping pieces
│       ├── clients.py        # shared Gemini + Chroma client setup
│       ├── ingest.py         # builds the vector store from data/sample_docs
│       ├── rag.py            # the actual retrieve -> augment -> generate pipeline
│       ├── query.py          # terminal chat loop (for testing without the UI)
│       └── server.py         # FastAPI app — what the React frontend talks to
└── frontend/
    ├── .env.example          # template for VITE_API_BASE
    └── src/
        ├── App.jsx           # the chat UI
        ├── api.js            # fetch wrapper calling the backend
        └── index.css
```

## Setup

### Backend

```powershell
cd d:\Z\rag-app\backend
py -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

`.env` already has your API key in it (moved there for you — see note below).
If you ever need to redo it: copy `.env.example` to `.env` and paste your key
in, but **never paste a real key into `.env.example`** — only `.env` is
git-ignored.

Build the vector store (do this once, and again any time you edit the files
in `data/sample_docs/`):

```powershell
.\.venv\Scripts\python.exe -m src.ingest
```

### Frontend

```powershell
cd d:\Z\rag-app\frontend
npm install
```

## Running the app

You need **two terminals** running at the same time:

```powershell
# Terminal 1 — backend
cd d:\Z\rag-app\backend
.\.venv\Scripts\python.exe -m uvicorn src.server:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — frontend
cd d:\Z\rag-app\frontend
npm run dev
```

Open **http://localhost:5173** in your browser. Interactive API docs for the
backend alone are at **http://localhost:8000/docs**.

There's also a terminal-only way to test the RAG pipeline, no UI needed:

```powershell
cd d:\Z\rag-app\backend
.\.venv\Scripts\python.exe -m src.query
```

## Testing on your phone

Since this is one responsive web app (not a separate native app), "mobile"
means opening the same site in your phone's browser:

1. Make sure your phone is on the **same Wi-Fi network** as this PC.
2. Both dev servers already bind to `0.0.0.0` (`--host 0.0.0.0` for uvicorn,
   `host: true` in `vite.config.js`), so they're reachable from other
   devices, not just this PC.
3. Your PC's current LAN IP is **172.168.1.240** (find it again anytime with
   `ipconfig`, look for the Wi-Fi adapter's IPv4 address — it can change).
4. On your phone's browser, go to `http://172.168.1.240:5173`.
5. **Important**: the frontend calls the backend at whatever `VITE_API_BASE`
   is set to (default `http://localhost:8000`). On a phone, "localhost" means
   the phone itself, which has no backend running — so you must override it.
   Create `frontend/.env`:
   ```
   VITE_API_BASE=http://172.168.1.240:8000
   ```
   and restart `npm run dev`.
6. Windows Firewall may prompt to allow Python/Node to accept connections on
   a private network the first time — allow it, or the phone's requests
   will just time out.

## Deployment

The frontend and backend deploy to **different hosts** — Vercel is a great
fit for the static React build, but not for the backend (see below).

### Why not deploy the backend to Vercel too

Vercel's serverless functions only get a writable `/tmp`, which is **wiped
between invocations** — there's no persistent local disk. This backend's
Chroma vector store relies on writing to disk once (ingestion) and reading
it back on every later query, so it would effectively lose its index between
requests. That's a storage-model mismatch, not a size/timeout problem.

### Backend → Render

A `render.yaml` at the repo root already describes the service.

1. Push this repo to GitHub (`git remote add origin ...` then `git push`).
2. In the Render dashboard: **New → Blueprint**, pick the repo. Render reads
   `render.yaml` automatically (it points at `backend/` as the root, installs
   `requirements.txt`, and runs uvicorn).
3. After the first deploy, open the service's **Environment** tab and add
   `GOOGLE_API_KEY` with your real key (the blueprint deliberately leaves
   this blank so the key is never committed to git).
4. Note the public URL Render gives you, e.g. `https://rag-app-backend.onrender.com`.

**About the free tier**: Render's free web services have no persistent disk
and spin down after 15 minutes idle, so a cold start begins with an empty
`chroma_db/`. `server.py`'s startup hook already handles this — it
auto-rebuilds the index from `data/sample_docs/` if it finds the collection
empty, which takes a few seconds for this small demo set. If you later load
in a large personal document set, re-embedding on every cold start will get
slow/costly — that's the point where a paid Render plan with a persistent
disk, or a hosted vector store (Chroma Cloud, Pinecone, pgvector), starts to
make sense.

### Frontend → Vercel

A `frontend/vercel.json` already sets the build command and output directory.

1. In the Vercel dashboard: **New Project**, pick this repo, and set
   **Root Directory** to `frontend` (important — this is a monorepo).
2. Add an environment variable: `VITE_API_BASE` = your Render backend URL
   from above (e.g. `https://rag-app-backend.onrender.com`). Vite bakes
   `VITE_`-prefixed env vars in at *build* time, so changing this later
   means triggering a redeploy, not just a page refresh.
3. Deploy. Vercel gives you a public URL for the chat UI, shareable from any
   device — no LAN/phone-testing tricks needed anymore once both sides are
   deployed.

CORS on the backend is currently wide open (`allow_origins=["*"]` in
`server.py`) so this works immediately regardless of your Vercel URL. Fine
for a personal project; tighten it to your exact Vercel domain if this ever
handles anything sensitive.

## How it works (the actual RAG pipeline)

**Ingestion** (`src/ingest.py`, run once ahead of time):
1. Read every `.txt` file in `data/sample_docs/`.
2. **Chunk** each file into ~800-character overlapping pieces
   (`src/chunking.py`) — small, focused pieces retrieve more precisely than
   whole documents.
3. **Embed** each chunk with Gemini's embedding model — this turns text into
   a vector (a list of numbers) that captures its *meaning*, not just its
   words. Similar meanings end up as nearby vectors.
4. **Store** each vector + its original text in Chroma, a local vector
   database, persisted to `chroma_db/` on disk.

**Query** (`src/rag.py`, run per question):
1. **Retrieve**: embed the user's question the same way, then ask Chroma for
   the chunks whose vectors are closest to it (cosine/L2 distance under the
   hood — "closest" ≈ "most semantically similar").
2. **Augment**: paste those retrieved chunks into a prompt template, right
   alongside the question.
3. **Generate**: send that combined prompt to Gemini's chat model, which
   writes an answer grounded in the retrieved text and is told to say "I
   don't know" rather than guess if the answer isn't in the context.

Try asking the demo a question **not** covered in `data/sample_docs/` (e.g.
"What's the capital of France?") — it should refuse to guess, because the
prompt explicitly restricts it to the provided context. That refusal is the
whole point of RAG: it's what makes answers trustworthy instead of
plausible-sounding fabrications.

## Uploading your own documents

Click **📚 Documents** in the app header to open the documents panel. From
there:

- **Upload** a `.txt`, `.md`, `.pdf`, or `.docx` file (15MB limit). It's
  chunked and embedded immediately — no separate "rebuild" step needed — and
  becomes askable right away, alongside the original sample docs.
- **Uploads accumulate.** Every file you add stays in the knowledge base
  until you remove it; questions are answered from whichever chunks (sample
  or uploaded) are most relevant, regardless of source.
- **Re-uploading the same filename replaces it** — its old chunks are
  dropped first, so you can fix a typo'd document by just uploading it again
  under the same name.
- **Remove** any uploaded document with the ✕ next to it in the list. The
  three built-in sample docs are protected from removal (they're what the
  suggestion chips and README examples rely on) — everything else is fair
  game.

Under the hood: `backend/data/uploads/` holds the raw uploaded files (text
is extracted via `src/loaders.py` — plain read for `.txt`/`.md`, `pypdf` for
PDFs, `python-docx` for Word docs), separately from `backend/data/sample_docs/`
which holds the bundled demo content. `src/ingest.py`'s `ingest_uploaded_file()`
chunks + embeds + stores just the one new file, rather than re-processing
everything — the same chunking/embedding pipeline as ingestion, just scoped
to a single document instead of a full rebuild.

**One real limitation worth knowing**: `data/uploads/` is deliberately **not**
tracked in git (see `.gitignore`) — it's your personal, private content, not
something that belongs in the repo. Locally this just means uploads persist
on your disk like any other file. **On Render's free tier, which has no
persistent disk, this means uploaded documents do NOT survive a cold start**
(the backend spinning down after 15 min idle and restarting) — only the
git-tracked sample docs get auto-restored on startup. If you outgrow this,
see the Deployment section's note on paid disks / hosted vector stores.

## Troubleshooting

- **"Missing GOOGLE_API_KEY"** — `backend/.env` doesn't have a real key in
  it, or you're running commands from the wrong folder.
- **"No vector store found"** — run `py -m src.ingest` before querying.
- **503 UNAVAILABLE / "model overloaded"** — transient free-tier overload on
  Google's side; `src/rag.py` already retries automatically a few times.
- **`Backend unreachable` in the UI** — the FastAPI server isn't running, or
  `VITE_API_BASE` points at the wrong host (see phone testing above).
- **The `Direct use of automatic function calling (AFC)...` warning printed
  in the terminal** — harmless; it's the SDK suggesting a different API
  (`Chat.send_message`) meant for multi-turn tool-calling conversations,
  which this app doesn't use.
- **Model name errors ("no longer available")** — Google retires dated model
  names periodically. `config.py` uses the `gemini-flash-latest` alias for
  this reason; if it ever breaks, check
  https://ai.google.dev/gemini-api/docs/models for current names.

---

## What to learn next

You said you know nothing about RAG yet — here's a concrete map, roughly in
the order it'll click.

### Core concepts behind what you just ran
1. **Embeddings / vectors** — how text becomes a list of numbers, and why
   "king − man + woman ≈ queen" is the kind of thing that makes semantic
   search possible. (Search: "what are embeddings NLP".)
2. **Cosine similarity / vector distance** — the actual math behind "closest
   chunk to this question." Chroma does this for you, but understanding it
   demystifies retrieval completely.
3. **Tokens & context windows** — LLMs process "tokens," not characters or
   words, and every model has a max context length. This is *why* chunking
   and picking only the top-k chunks matters — you can't just paste every
   document in.
4. **Prompt engineering basics** — look at `PROMPT_TEMPLATE` in `rag.py`.
   Small wording changes there (e.g. "cite the source" or "answer in bullet
   points") noticeably change output — worth deliberately experimenting.
5. **Hallucination vs. grounding** — why LLMs confidently make things up, and
   why "answer only from this context" instructions (imperfectly) reduce it.

### Once those feel solid
6. **Chunking strategies** — fixed-size (what this app does) vs.
   sentence/paragraph-aware vs. semantic chunking. Chunk size/overlap are the
   two knobs you'll tune the most in any real RAG project.
7. **Vector databases** — Chroma is the simplest to run locally. Learn what
   FAISS, Pinecone, Weaviate, and pgvector each trade off (hosted vs. local,
   metadata filtering, scale).
8. **Retrieval quality** — top-k tuning, re-ranking retrieved chunks with a
   second, more precise model, and hybrid search (combining keyword/BM25
   search with vector search — pure vector search misses exact terms like
   product codes or names sometimes).
9. **Evaluating RAG** — how do you know if answers are actually good? Build a
   small set of question/expected-answer pairs and check retrieval + answer
   quality against it as you change things.

### To extend this project specifically
- Swap the fictional `.txt` files for your own **PDFs** (`pypdf` library) or
  Markdown notes.
- Add **conversation memory** so follow-up questions ("what about the second
  one?") work — currently every question is independent.
- Show **inline citations** in the answer text, not just a sources list.
- Add a **re-ranking** step between retrieve and generate.
- Try swapping Chroma for **FAISS** or a hosted vector DB, to learn the
  differences hands-on.
- Deploy it: the frontend is a static build (`npm run build`) deployable
  anywhere (Vercel, Netlify); the backend needs a host that runs a persistent
  Python process (Render, Railway, Fly.io, or a small VM) since it keeps a
  local vector store on disk.
- Package the two into Docker containers once you're comfortable with the
  moving parts — good next step for "production-shaped" thinking.

### On your API key
One thing worth double-checking: standard Google AI Studio keys usually start
with `AIza...`. Yours doesn't match that pattern — it still worked for both
embeddings and generation in testing, so it's very likely a valid key of a
different type, but if you ever see auth errors, confirm at
https://aistudio.google.com/apikey that this is the exact key shown there.
