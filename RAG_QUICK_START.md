# RAG Quick Start - 5 Minuti

## Setup Iniziale (Una Volta)

```bash
# 1. Assicurati che PostgreSQL sia in esecuzione
# 2. Verifica .env
echo $OPENAI_API_KEY  # Deve essere impostato

# 3. Avvia server
npm run dev
```

## Test Completo (3 Comandi)

```bash
# 1. CREA NODO
curl -X POST http://localhost:3000/api/rag/nodes \
  -H "Content-Type: application/json" \
  -d '{"name":"Documenti Legali","description":"Test RAG"}' \
  | jq -r '.node.id'

# Salva l'ID del nodo (es: clxxx...)
export NODE_ID="clxxx..."

# 2. CARICA DOCUMENTO
curl -X POST "http://localhost:3000/api/rag/nodes/$NODE_ID/upload" \
  -F "file=@/path/to/documento.pdf" \
  | jq '.'

# 3. FAI UNA DOMANDA
curl -X POST http://localhost:3000/api/rag/answer \
  -H "Content-Type: application/json" \
  -d "{
    \"nodeId\": \"$NODE_ID\",
    \"query\": \"Riassumi i punti principali del documento\",
    \"model\": \"gpt-4o-mini\"
  }" \
  | jq '.answer'
```

## Risposta Attesa

```json
{
  "answer": "Secondo il documento fornito:\n\n1. **Punto principale 1** [Doc: documento.pdf, pag: 1]\n...",
  "citations": [
    {
      "documentId": "clyyy...",
      "filename": "documento.pdf",
      "page": 1,
      "chunkId": "clzzz...",
      "excerpt": "Testo rilevante dal documento..."
    }
  ],
  "usage": {
    "promptTokens": 1250,
    "completionTokens": 320,
    "totalTokens": 1570,
    "cost": 0.0024
  },
  "telemetry": {
    "tTotalMs": 3200,
    "tRetrievalMs": 450,
    "tLlmMs": 2700
  }
}
```

## API Endpoints

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/rag/nodes` | POST | Crea nodo RAG |
| `/api/rag/nodes` | GET | Lista nodi |
| `/api/rag/nodes/[id]/upload` | POST | Upload documento (multipart) |
| `/api/rag/query` | POST | Solo retrieval (no LLM) |
| `/api/rag/answer` | POST | Pipeline completa (retrieval + LLM) |

## Parametri Chiave

### Upload
- **Limite**: 50MB
- **Formati**: PDF, DOCX, DOC, TXT

### Query/Answer
- **topK**: Candidati per metodo (default: 20)
- **returnK**: Risultati finali (default: 5)
- **hybridAlpha**: 0=text, 1=vector, 0.5=bilanciato
- **temperature**: Temperatura LLM (default: 0.1)
- **model**: `gpt-4o-mini`, `gpt-4o`, `claude-3-5-sonnet-20241022`

## Troubleshooting Rapido

### "RAG node not found"
```bash
# Verifica che il nodo esista
curl http://localhost:3000/api/rag/nodes | jq '.nodes'
```

### "No documents uploaded"
```bash
# Verifica che l'upload sia andato a buon fine
# Controlla i log del server per errori di parsing
```

### "No text content extracted"
- PDF scansionato (immagine)? Usa OCR prima
- File corrotto? Prova con altro file

### Timeout
- Riduci `topK` e `returnK`
- Usa modello più veloce (`gpt-4o-mini`)

## Files Creati

```
/lib/rag/
  ├── types.ts              # Tipi e DTOs
  ├── storage.ts            # Filesystem adapter
  ├── embeddings.ts         # OpenAI embeddings
  ├── chunker.ts            # Text chunking
  ├── parser.ts             # Document parsing
  ├── retrieval.ts          # Hybrid search
  ├── prompt.ts             # Prompt templates
  └── answerOrchestrator.ts # Pipeline end-to-end

/app/api/rag/
  ├── nodes/route.ts        # POST/GET nodes
  ├── nodes/[id]/upload/route.ts  # Upload
  ├── query/route.ts        # Retrieval only
  └── answer/route.ts       # Full pipeline

/prisma/migrations/
  └── 20251002172328_add_rag_system/  # DB migration

Docs:
  ├── RAG_README.md         # Guida completa
  ├── RAG_IMPLEMENTATION_SUMMARY.md  # Summary tecnico
  ├── RAG_QUICK_START.md    # Questo file
  ├── rag-api-collection.json  # Postman collection
  └── test-rag.sh           # Script test
```

## Prossimi Passi

1. **Test con documenti reali**: Carica PDF/DOCX legali
2. **Tuning retrieval**: Sperimenta con `topK`, `returnK`, `hybridAlpha`
3. **Confronto modelli**: Prova `gpt-4o` vs `claude-3-5-sonnet`
4. **Monitoring**: Analizza telemetria per ottimizzazioni

## Supporto

- **Docs completa**: `RAG_README.md`
- **Summary tecnico**: `RAG_IMPLEMENTATION_SUMMARY.md`
- **Postman collection**: `rag-api-collection.json`
- **Test script**: `./test-rag.sh`
