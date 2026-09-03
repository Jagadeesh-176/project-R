"""
Terminal chat loop for the RAG pipeline — handy for testing without the web UI.

Run with:
    py -m src.query

Try asking things that ARE answered in data/sample_docs/ (e.g. "How many PTO
days do Acme employees get?") and things that are NOT (e.g. "What's the
capital of France?") to see the grounding behavior kick in.

All the actual RAG logic lives in src/rag.py — this file just wires it up to
stdin/stdout. server.py wires the same rag.py functions up to a web API
instead.
"""
from src.clients import get_collection, require_api_key
from src.rag import answer_question


def main():
    require_api_key()

    try:
        get_collection(create_if_missing=False)
    except Exception:
        raise SystemExit("No vector store found yet. Run `py -m src.ingest` first.")

    print("RAG demo ready. Ask a question (or type 'exit').\n")
    while True:
        question = input("You: ").strip()
        if not question:
            continue
        if question.lower() in ("exit", "quit"):
            break

        result = answer_question(question)

        print(f"\nAssistant: {result['answer']}\n")
        print("Sources used:")
        for s in result["sources"]:
            print(
                f"  - {s['source']} (chunk {s['chunk_index']}, "
                f"distance={s['distance']:.3f}): {s['preview']}..."
            )
        print()


if __name__ == "__main__":
    main()
