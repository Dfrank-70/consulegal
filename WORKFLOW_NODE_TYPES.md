# Workflow Node Types - Documentazione Tecnica

**Data:** 19 Gennaio 2026  
**Progetto:** ConsuLegal - Sistema Workflow AI

---

## 📋 Panoramica

Il sistema workflow di ConsuLegal supporta **4 tipi di nodi** che possono essere combinati per creare flussi di elaborazione AI complessi. Ogni nodo ha uno schema dati specifico e una logica di esecuzione nel backend.

### Tipi Supportati

| Tipo | Descrizione | Colore UI | Handles |
|------|-------------|-----------|---------|
| `input` | Punto di ingresso del workflow | Verde (`green-900`) | Source (→) |
| `llm` | Elaborazione con modello LLM | Blu (`blue-500`) | Target (←) + Source (→) |
| `rag` | Retrieval documenti da knowledge base | Viola (`purple-500`) | Target (←) + Source (→) |
| `output` | Risultato finale del workflow | Rosso (`red-900`) | Target (←) |

---

## 1. Node Type: `input`

### 📝 Descrizione
Rappresenta il punto di ingresso del workflow. Riceve l'input iniziale dell'utente e lo passa al nodo successivo senza modifiche.

### 🗃️ Schema Dati (`data` field)

```typescript
{
  label?: string; // Etichetta visualizzata (default: "Punto di ingresso")
}
```

**Nota:** Il nodo `input` non ha campi di configurazione significativi. Il campo `data` è generalmente vuoto o contiene solo una label.

### ⚙️ Esecuzione Backend

**File:** `lib/workflow-executor.ts:89-94`

```typescript
if (node.type === 'input') {
  step.output = input;  // Passa l'input senza modifiche
  step.success = true;
  return step;
}
```

**Comportamento:**
- Riceve `initialInput` (stringa da utente)
- Restituisce lo stesso valore come `output`
- Non consuma token
- Sempre successo

### 🚫 Limitazioni
- **Nessuna condizione supportata:** Non può filtrare o validare l'input
- **Nessuna trasformazione:** L'input passa invariato
- **Unico nodo per workflow:** Deve esistere esattamente 1 nodo `input` per workflow valido

---

## 2. Node Type: `llm`

### 📝 Descrizione
Esegue un modello LLM (OpenAI o Anthropic Claude) con prompt configurabile. Riceve input dal nodo precedente, applica le istruzioni custom e restituisce la risposta del modello.

### 🗃️ Schema Dati (`data` field)

```typescript
{
  providerId: string;          // ID del provider LLM (riferimento a LLMProvider.id)
  model: string;               // ID modello (es. "gpt-3.5-turbo", "claude-3-haiku-20240307")
  customInstruction?: string;  // System prompt (parte 1)
  prompt?: string;             // Agent instruction (parte 2)
  temperature?: number;        // 0-2, default 0.7
  maxTokens?: number;          // Limite token output, default 1000
  
  // Legacy (deprecato, usare providerId)
  provider?: string;           // Nome provider (es. "OpenAI")
}
```

**System Prompt Combinato:**
```
systemPrompt = customInstruction + "\n\n" + prompt
```

### ⚙️ Esecuzione Backend

**File:** `lib/workflow-executor.ts:145-252`

#### Selezione Provider
1. Cerca provider per `providerId` (preferito)
2. Fallback a `provider` (nome, legacy)
3. Fallback a primo provider OpenAI attivo

#### OpenAI
- **Endpoint:** `chat.completions.create` (default) o `completions.create` (modelli `text-*`, `*-instruct`)
- **Messaggi:**
  ```typescript
  [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: input }
  ]
  ```
- **Costo:** ~$0.0015/1K input tokens, ~$0.002/1K output tokens (gpt-3.5-turbo)

#### Anthropic Claude
- **Endpoint:** `messages.create`
- **System:** `systemPrompt` passato come parametro `system`
- **Messaggi:** `[{ role: 'user', content: input }]`
- **Costo:** ~$0.25/1M input tokens, ~$1.25/1M output tokens (haiku)

### 🎛️ UI Configuration

**File:** `app/dashboard/admin/workflows/[id]/page.tsx:318-366`

- **Provider:** Dropdown con provider attivi da DB
- **Modello:** Dropdown dinamico (fetch da `/api/admin/llm-providers/{id}/models`)
- **Agent Instruction:** Textarea per `prompt`
- **Temperatura:** Input numerico 0-2

**Nota:** `customInstruction` non è configurabile da UI (solo `prompt`). Per modificare `customInstruction` serve accesso diretto a DB.

### 🚫 Limitazioni
- **Nessun branching condizionale:** Non può scegliere il prossimo nodo in base all'output
- **Nessuna conversazione multi-turn nativa:** Ogni esecuzione è stateless (non passa history)
- **Provider supportati:** Solo OpenAI e Claude (altri causano errore)
- **Timeout:** Non configurabile (dipende da timeout HTTP della piattaforma)

---

## 3. Node Type: `rag`

### 📝 Descrizione
Esegue una query di retrieval su una knowledge base RAG (Retrieval-Augmented Generation). Utilizza hybrid search (text + vector similarity) per recuperare i chunk di documenti più rilevanti.

### 🗃️ Schema Dati (`data` field)

```typescript
{
  ragNodeId: string;      // ID del RagNode da interrogare (riferimento a RagNode.id)
  ragNodeName?: string;   // Nome del nodo RAG (solo display)
  topK?: number;          // Numero di risultati da ritornare (default: 5)
  alpha?: number;         // Bilanciamento hybrid search 0-1 (default: 0.5)
}
```

**Alpha Parameter:**
- `0.0` = Solo text search (pg_trgm)
- `0.5` = Bilanciato (hybrid)
- `1.0` = Solo vector search (pgvector cosine)

### ⚙️ Esecuzione Backend

**File:** `lib/workflow-executor.ts:103-143`

#### Processo
1. Valida `ragNodeId` (errore se mancante)
2. Estrae parametri `topK` (default 5) e `alpha` (default 0.5)
3. Chiama `hybridRetrieval(ragNodeId, input, { returnK: topK, alpha, topK: 20 })`
4. Formatta risultati:
   ```
   [RAG Query: "{input}"]
   
   Contesti rilevanti trovati (N):
   
   [Fonte 1: filename.pdf - Score: 0.873]
   {chunk content}
   
   ---
   
   [Fonte 2: ...]
   ```

#### Token Calculation
- **Input tokens:** `Math.ceil(input.length / 4)` (approssimato)
- **Output tokens:** `Math.ceil(output.length / 4)` (approssimato)
- **Costo:** 0 (nessuna chiamata LLM, solo DB query)

### 🎛️ UI Configuration

**File:** `app/dashboard/admin/workflows/[id]/page.tsx:368-412`

- **Nodo RAG:** Dropdown con nodi RAG disponibili (fetch da `/api/rag/nodes`)
- **Top-K Risultati:** Input numerico 1-20
- **Alpha:** Input numerico 0-1 (step 0.1)

### 🚫 Limitazioni
- **Nessun re-ranking:** I risultati sono ordinati solo per score hybrid
- **Nessun filtering semantico:** Non può filtrare per metadata (es. data, categoria)
- **Single node query:** Non può interrogare più knowledge base in parallelo
- **Errore se ragNodeId mancante:** Il nodo deve essere configurato prima dell'esecuzione
- **Nessuna fallback strategy:** Se 0 risultati, passa messaggio "Nessun documento rilevante"

---

## 4. Node Type: `output`

### 📝 Descrizione
Rappresenta il risultato finale del workflow. Riceve l'output del nodo precedente e lo restituisce senza modifiche. Il suo valore viene mostrato all'utente come risposta finale.

### 🗃️ Schema Dati (`data` field)

```typescript
{
  label?: string; // Etichetta visualizzata (default: "Risultato finale")
}
```

**Nota:** Come `input`, il nodo `output` non ha campi di configurazione. Il campo `data` è generalmente vuoto.

### ⚙️ Esecuzione Backend

**File:** `lib/workflow-executor.ts:96-101`

```typescript
if (node.type === 'output') {
  step.output = input;  // Passa l'input senza modifiche
  step.success = true;
  return step;
}
```

**Comportamento:**
- Riceve output del nodo precedente
- Restituisce lo stesso valore
- Non consuma token
- Sempre successo

**Funzione Helper:**
```typescript
// lib/workflow-executor.ts:385-395
function getWorkflowFinalOutput(execution: WorkflowExecution): string {
  const outputStep = execution.steps.find(step => step.type === 'output') || 
                    execution.steps[execution.steps.length - 1];
  return outputStep.output;
}
```

### 🚫 Limitazioni
- **Nessuna trasformazione:** L'output passa invariato
- **Nessun formatting:** Non può applicare template o markdown
- **Opzionale ma raccomandato:** Il workflow funziona anche senza nodo `output` (usa ultimo step), ma è best practice includerlo

---

## 🗄️ Struttura Database

### WorkflowNode Table

**File:** `prisma/schema.prisma:60-71`

```prisma
model WorkflowNode {
  id         String   @id @default(cuid())
  workflowId String
  
  nodeId   String  // ID univoco nel canvas React Flow
  type     String  // "input" | "llm" | "rag" | "output"
  position Json    // { x: number, y: number }
  data     Json    // Schema varia per tipo (vedi sopra)
  
  workflow Workflow @relation(...)
  @@unique([workflowId, nodeId])
}
```

**Nota:** Il campo `type` è una stringa generica. Non c'è validazione a livello DB dei valori consentiti. La validazione avviene a runtime nell'executor.

### WorkflowEdge Table

**File:** `prisma/schema.prisma:73-84`

```prisma
model WorkflowEdge {
  id         String   @id @default(cuid())
  workflowId String
  
  edgeId   String  // ID univoco edge React Flow
  sourceId String  // WorkflowNode.nodeId di origine
  targetId String  // WorkflowNode.nodeId destinazione
  data     Json?   // Dati custom (attualmente inutilizzato)
  
  workflow Workflow @relation(...)
  @@unique([workflowId, edgeId])
}
```

**Nota:** Il campo `edge.data` è definito ma **non utilizzato** nell'executor. Non supporta condizioni o routing logico.

---

## 🔄 Logica di Esecuzione

### Algoritmo Sequenziale

**File:** `lib/workflow-executor.ts:264-382`

```typescript
1. Carica workflow + nodes + edges da DB
2. Carica provider LLM attivi
3. Trova nodo di tipo "input"
4. currentNode = inputNode
5. currentInput = initialInput (messaggio utente)
6. WHILE currentNode exists AND stepCount < maxSteps:
     a. Esegui currentNode con currentInput
     b. Salva step in execution log
     c. Se step.success == false, THROW error
     d. currentInput = step.output
     e. Trova edge con sourceId == currentNode.nodeId
     f. currentNode = node con nodeId == edge.targetId
7. Salva WorkflowExecutionLog in DB
8. Return execution
```

### Limitazioni Architetturali

#### ❌ NON Supportato
1. **Branching condizionale**
   - Gli edge non hanno logica `if/else`
   - Sempre percorso lineare: Input → [N nodi] → Output

2. **Parallelismo**
   - Nodi eseguiti sempre in sequenza
   - Non supporta fan-out (1 nodo → N nodi) o fan-in (N nodi → 1 nodo)

3. **Loop / Iterazioni**
   - Nessun supporto per cicli
   - `maxSteps = nodes.length + 1` previene loop infiniti

4. **Conversazione History**
   - Ogni esecuzione è **stateless**
   - Non passa messaggi precedenti agli LLM
   - Per multi-turn serve implementazione custom nel prompt

5. **Error Handling Granulare**
   - Primo errore = stop workflow completo
   - Nessun retry automatico
   - Nessun fallback path

6. **Dynamic Routing**
   - Non può scegliere prossimo nodo in base a output LLM
   - Nessun `switch/case` logic

#### ✅ Pattern Supportati

```
✅ Linear Chain
Input → LLM1 → LLM2 → Output

✅ RAG + LLM
Input → RAG → LLM → Output

✅ Multi-Step Processing
Input → RAG → LLM1 → LLM2 → Output
```

```
❌ Conditional Branching (NON supportato)
Input → LLM1 → [if positive → LLM2, else → LLM3] → Output

❌ Parallel Processing (NON supportato)
Input → [LLM1 + LLM2 in parallelo] → Merge → Output

❌ Loop (NON supportato)
Input → LLM → [if not satisfied, loop to LLM] → Output
```

---

## 🧪 Testing & Debugging

### Verifica Node Types da DB

```javascript
// Script: check-default-workflow.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const workflow = await prisma.workflow.findFirst({
  where: { isDefault: true },
  include: { nodes: true, edges: true }
});

workflow.nodes.forEach(node => {
  console.log(`Nodo ${node.nodeId}:`);
  console.log(`  Tipo: ${node.type}`);
  console.log(`  Data:`, node.data);
});
```

### Verifica Esecuzione

```javascript
// Query execution log
const log = await prisma.workflowExecutionLog.findFirst({
  where: { userId: 'user_id' },
  orderBy: { startedAt: 'desc' }
});

console.log('Steps eseguiti:', log.steps);
// log.steps è array di WorkflowStep con:
// - nodeId, type, input, output, tokensIn/Out, cost, success
```

### Common Issues

1. **"Nodo di input non trovato nel workflow"**
   - Causa: Workflow senza nodo `type: "input"`
   - Fix: Aggiungi nodo input al workflow

2. **"Provider non trovato o non attivo"**
   - Causa: `providerId` riferisce a provider inesistente/disabilitato
   - Fix: Verifica `LLMProvider.isActive = true`

3. **"Nodo RAG non configurato: manca ragNodeId"**
   - Causa: Nodo RAG senza campo `data.ragNodeId`
   - Fix: Configura ragNodeId da UI workflow editor

4. **"Errore nell'esecuzione del nodo X"**
   - Causa: Step fallito (es. API timeout, invalid model)
   - Fix: Controlla `step.error` nel log per dettagli

---

## 📚 File di Riferimento

### Frontend
- **Editor UI:** `app/dashboard/admin/workflows/[id]/page.tsx`
  - Componenti nodo: righe 42-82
  - nodeTypes mapping: righe 86-91
  - UI configurazione: righe 311-420

### Backend
- **Executor:** `lib/workflow-executor.ts`
  - Interface WorkflowNode: righe 7-20
  - executeNode(): righe 69-262
  - executeWorkflow(): righe 264-382

### Database
- **Schema:** `prisma/schema.prisma`
  - WorkflowNode: righe 60-71
  - WorkflowEdge: righe 73-84
  - Workflow: righe 46-58

### API
- **Workflow CRUD:** `app/api/admin/workflows/` (non analizzato)
- **RAG Nodes:** `app/api/rag/nodes/route.ts` (non analizzato)
- **LLM Providers:** `app/api/admin/llm-providers/` (non analizzato)

---

## 🎯 Best Practices

### Progettazione Workflow

1. **Sempre includere Input e Output**
   - Anche se opzionali, migliorano leggibilità

2. **Prompt chiari e specifici**
   - Usa `customInstruction` per ruolo generale
   - Usa `prompt` per task specifico

3. **RAG prima di LLM**
   - Pattern ottimale: Input → RAG → LLM → Output
   - LLM riceve contesto formattato da RAG

4. **Temperature adeguate**
   - Analisi/estrazione: 0.0-0.3
   - Generazione creativa: 0.7-1.0
   - Default: 0.7

5. **Gestione token**
   - `maxTokens` default 1000 potrebbe essere insufficiente per output lunghi
   - Monitora `totalTokens` in `WorkflowExecutionLog`

### Testing

1. **Test incrementale**
   - Testa ogni nodo singolarmente prima di concatenarli
   - Usa workflow semplici (Input → LLM → Output)

2. **Verifica log**
   - Controlla `WorkflowExecutionLog.steps` per debug
   - Ogni step mostra input/output/error

3. **Provider fallback**
   - Testa sia con OpenAI che Claude
   - Verifica comportamento con provider inattivo

---

## 🔮 Sviluppi Futuri

### Node Types Potenziali

1. **`condition`** - Branching condizionale
   ```typescript
   data: {
     condition: string;     // Espressione JS o pattern matching
     truePath: string;      // nodeId se true
     falsePath: string;     // nodeId se false
   }
   ```

2. **`transform`** - Trasformazione testo
   ```typescript
   data: {
     operation: "json_parse" | "markdown_to_text" | "regex_extract";
     config: Record<string, any>;
   }
   ```

3. **`api`** - Chiamata API esterna
   ```typescript
   data: {
     url: string;
     method: "GET" | "POST";
     headers?: Record<string, string>;
     body?: string;
   }
   ```

4. **`merge`** - Combinazione multi-input
   ```typescript
   data: {
     strategy: "concat" | "json_merge" | "template";
     template?: string;
   }
   ```

### Miglioramenti Architetturali

1. **Edge Conditions**
   - Aggiungere logica a `WorkflowEdge.data.condition`
   - Eseguire evaluation runtime per routing dinamico

2. **Parallel Execution**
   - Supportare fan-out/fan-in
   - Eseguire branch indipendenti in parallelo

3. **Conversation Context**
   - Passare history messaggi agli LLM
   - Implementare sliding window per token limit

4. **Error Recovery**
   - Retry automatico con backoff
   - Fallback path se nodo fallisce
   - Graceful degradation

---

**Fine Documentazione**
