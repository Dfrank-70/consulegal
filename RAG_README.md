# RAG Answer Node - Guida Rapida

Sistema RAG (Retrieval-Augmented Generation) integrato in ConsuLegal con retrieval ibrido (pg_trgm + pgvector).

## Architettura

### Database
- **Estensioni PostgreSQL**: `pgvector` (embeddings) + `pg_trgm` (full-text search)
- **Tabelle**:
  - `rag_nodes`: Contenitori logici per documenti
  - `rag_documents`: Metadati dei file caricati
  - `rag_chunks`: Chunk di testo (900 char, overlap 120)
  - `rag_embeddings`: Vettori 3072-dim (OpenAI text-embedding-3-large)

### Adapters (`/lib/rag/`)
- **storage.ts**: Filesystem locale (./rag-storage)
- **embeddings.ts**: OpenAI text-embedding-3-large
- **chunker.ts**: Preset configurabili (legal/faq/table/email/default)
- **retrieval.ts**: Hybrid search (pg_trgm ∪ pgvector, merge & dedup)
- **prompt.ts**: Template con "grounding duro" e citazioni obbligatorie
- **answerOrchestrator.ts**: Pipeline end-to-end (retrieval → LLM → citations)
- **parser.ts**: Supporto PDF, DOCX, DOC, TXT

## API Routes

### 1. Creare un Nodo RAG
```bash
POST /api/rag/nodes
Content-Type: application/json

{
  "name": "Normativa Trasporti 2024",
  "description": "Raccolta leggi e circolari trasporti"
}
```

**Risposta**:
```json
{
  "node": {
    "id": "clxxx...",
    "name": "Normativa Trasporti 2024",
    "description": "Raccolta leggi e circolari trasporti",
    "createdAt": "2024-10-02T17:30:00.000Z",
    "updatedAt": "2024-10-02T17:30:00.000Z"
  }
}
```

### 2. Caricare un Documento
```bash
POST /api/rag/nodes/{nodeId}/upload
Content-Type: multipart/form-data

file: @/path/to/documento.pdf
```

**Risposta**:
```json
{
  "document": {
    "id": "clyyy...",
    "nodeId": "clxxx...",
    "filename": "documento.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 1234567,
    "storagePath": "clxxx.../1696262400000_documento.pdf",
    "metadata": { "pages": 15 },
    "createdAt": "2024-10-02T17:35:00.000Z"
  },
  "chunksCreated": 42,
  "embeddingsCreated": 42,
  "processingTimeMs": 8500
}
```

**Formati supportati**: PDF, DOCX, DOC, TXT (max 50MB)

### 3. Query (solo retrieval)
```bash
POST /api/rag/query
Content-Type: application/json

{
  "nodeId": "clxxx...",
  "query": "Quali sono gli obblighi per il trasporto merci pericolose?",
  "topK": 20,
  "returnK": 5,
  "hybridAlpha": 0.5
}
```

**Parametri**:
- `topK`: Candidati da ciascun metodo (text + vector)
- `returnK`: Risultati finali dopo merge
- `hybridAlpha`: 0 = solo text, 1 = solo vector, 0.5 = bilanciato

**Risposta**:
```json
{
  "contexts": [
    {
      "chunkId": "clzzz...",
      "documentId": "clyyy...",
      "filename": "documento.pdf",
      "content": "Art. 15 - Il trasporto di merci pericolose...",
      "score": 0.87,
      "metadata": { "page": 3 }
    }
  ],
  "retrievalTimeMs": 450
}
```

### 4. Answer (retrieval + LLM + citazioni)
```bash
POST /api/rag/answer
Content-Type: application/json

{
  "nodeId": "clxxx...",
  "query": "Quali sono gli obblighi per il trasporto merci pericolose?",
  "topK": 20,
  "returnK": 5,
  "temperature": 0.1,
  "model": "gpt-4o-mini"
}
```

**Modelli supportati**:
- OpenAI: `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`
- Anthropic: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`

**Risposta**:
```json
{
  "answer": "Secondo la normativa vigente, il trasporto di merci pericolose richiede:\n\n1. **Certificazione ADR** [Doc: documento.pdf, pag: 3]\n...",
  "citations": [
    {
      "documentId": "clyyy...",
      "filename": "documento.pdf",
      "page": 3,
      "chunkId": "clzzz...",
      "excerpt": "Art. 15 - Il trasporto di merci pericolose..."
    }
  ],
  "rawContexts": [...],
  "usage": {
    "promptTokens": 1250,
    "completionTokens": 320,
    "totalTokens": 1570,
    "cost": 0.0024
  },
  "telemetry": {
    "tTotalMs": 3200,
    "tRetrievalMs": 450,
    "tLlmMs": 2700,
    "tEmbeddingMs": 180
  }
}
```

## Test Rapido

### 1. Setup
```bash
# Assicurati che PostgreSQL sia in esecuzione
# Le estensioni pgvector e pg_trgm sono già installate dalla migration

# Variabili d'ambiente richieste (.env)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...  # Opzionale, solo per Claude
```

### 2. Workflow Completo
```bash
# 1. Crea un nodo
curl -X POST http://localhost:3000/api/rag/nodes \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Node","description":"Test RAG"}'

# Salva il nodeId dalla risposta
NODE_ID="clxxx..."

# 2. Carica un PDF
curl -X POST http://localhost:3000/api/rag/nodes/$NODE_ID/upload \
  -F "file=@/path/to/documento.pdf"

# 3. Fai una domanda
curl -X POST http://localhost:3000/api/rag/answer \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId":"'$NODE_ID'",
    "query":"Riassumi i punti principali del documento",
    "model":"gpt-4o-mini"
  }'
```

## Configurazione Avanzata

### Preset di Chunking
Modifica in `/lib/rag/types.ts`:
```typescript
export const CHUNK_PRESETS: Record<ChunkPreset, ChunkConfig> = {
  default: { chunkSize: 900, overlap: 120 },
  legal: { chunkSize: 1200, overlap: 200 },    // Documenti legali lunghi
  faq: { chunkSize: 600, overlap: 80 },        // Q&A brevi
  table: { chunkSize: 1500, overlap: 100 },    // Tabelle/dati strutturati
  email: { chunkSize: 800, overlap: 100 },     // Email/corrispondenza
};
```

### Prompt System
Il prompt in `/lib/rag/prompt.ts` impone:
- **Grounding duro**: Rispondere SOLO dal CONTEXT
- **Citazioni obbligatorie**: Formato `[Doc: filename, pag: X]`
- **Fallback esplicito**: "Non ho trovato informazioni sufficienti..."

### Retrieval Ibrido
Algoritmo in `/lib/rag/retrieval.ts`:
1. **Text Search**: pg_trgm con `SIMILARITY()` (trigram matching)
2. **Vector Search**: pgvector con `<=>` (cosine distance)
3. **Merge**: `hybrid_score = (1-α)*text_score + α*vector_score`
4. **Dedup**: GROUP BY chunk_id, MAX(scores)

## Logging
Tutti gli eventi emettono JSON strutturato su stdout:
```json
{
  "event": "rag_answer_complete",
  "nodeId": "clxxx...",
  "contextsUsed": 5,
  "citationsExtracted": 3,
  "answerLength": 450,
  "telemetry": { "tTotalMs": 3200, "tRetrievalMs": 450, "tLlmMs": 2700 },
  "usage": { "totalTokens": 1570, "cost": 0.0024 }
}
```

## Limitazioni Attuali
- Storage filesystem locale (no S3/presigned URLs)
- Nessuna autenticazione sulle API RAG
- Timeout 60s su `/api/rag/answer`
- Limite file 50MB
- Nessun rate limiting

## Prossimi Passi (Produzione)
1. Autenticazione JWT/session sulle API
2. Storage adapter S3 con presigned URLs
3. Queue system per upload asincroni (BullMQ/Inngest)
4. Caching embeddings (Redis)
5. Monitoring (Prometheus/Grafana)
6. UI admin per gestione nodi/documenti
