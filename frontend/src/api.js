// Thin wrapper around the backend HTTP API (see backend/src/server.py).
// Every function here mirrors one endpoint 1:1 — no RAG logic lives in the
// frontend, it's purely a client for the Python backend.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

async function handleResponse(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function askQuestion(question) {
  const res = await fetch(`${API_BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return handleResponse(res);
}

export async function rebuildIndex(reset = false) {
  const res = await fetch(`${API_BASE}/api/ingest?reset=${reset}`, {
    method: "POST",
  });
  return handleResponse(res);
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
