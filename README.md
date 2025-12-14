# TED Talk RAG Agent 🎙️

A Retrieval-Augmented Generation (RAG) agent capable of answering questions based on a dataset of TED Talks. This project uses semantic search to retrieve relevant transcript chunks and generates accurate, cited responses using an LLM.

## Tech Stack
* **Runtime:** Node.js (TypeScript)
* **Vector Database:** Pinecone (Serverless)
* **LLM Provider:** OpenAI-compatible API (LLMod)
* **Deployment:** Vercel
* **Embedding Model:** `text-embedding-3-small`

## Features
* **Semantic Search:** Uses cosine similarity to find relevant talk segments.
* **Smart Chunking:** Recursive character splitting with metadata enrichment (Speaker + Title injection) for higher retrieval accuracy.
* **Source Citations:** Returns exact transcript chunks and metadata used to generate the answer.
* **Budget Optimized:** Efficient token usage and caching strategies.

## API Usage

### Query the Agent
**Endpoint:** `POST /api/prompt`

```bash
curl -X POST [https://rag-agent-henna.vercel.app/api/prompt](https://rag-agent-henna.vercel.app/api/prompt) \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"Who talks about urban planning?\"}"
