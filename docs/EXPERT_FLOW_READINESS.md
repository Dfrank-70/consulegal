# ARCHIVED

**Superseded by:** `docs/CURRENT_SPEC.md`

**Archived copy:** `docs/archive/2026-01-22_EXPERT_FLOW_READINESS.md`

---

# Expert Flow Readiness Assessment
**Data:** 20 Gennaio 2026  
**Obiettivo:** Analisi tecnica per implementazione flusso "Expert Review" (casi/ticket gestiti da operatori)

---

## 1. Workflow "di Sistema" (Globale)

### ✅ **ESISTE GIÀ**

**Location:** `prisma/schema.prisma:46-58`

```prisma
model Workflow {
  id          String   @id @default(cuid())
  name        String
  description String?
  isDefault   Boolean  @default(false)
  userId      String? // ⭐ Se null, è un template globale. Se valorizzato, è una copia per un utente specifico.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  nodes WorkflowNode[]
  edges WorkflowEdge[]
  users User[]
}
```

### **Meccanismo Esistente**
- **Workflow globali/sistema:** `userId = null`
- **Workflow default:** `isDefault = true`
- **Workflow utente-specifici:** `userId = <user_id>`

### **Utilizzo nel Sistema**
**File:** `app/api/chat/route.ts:405-420`

```typescript
// Determina quale workflow utilizzare
let workflowToUse = user.workflow;

// Se l'utente non ha un workflow assegnato, usa quello di default
if (!workflowToUse) {
  workflowToUse = await prisma.workflow.findFirst({
    where: { isDefault: true }, // ⭐ Cerca workflow globale di default
    include: { nodes: true, edges: true },
  });
}
```

### **Proposta Miglioramento (Opzionale)**
Aggiungere campo `scope` per categorizzare meglio:

```prisma
enum WorkflowScope {
  SYSTEM    // Workflow di sistema (es: expert review, automated routing)
  TEMPLATE  // Template copiabili dagli utenti
  USER      // Workflow personalizzati utente
}

model Workflow {
  // ... campi esistenti ...
  scope WorkflowScope @default(USER)
}
```

---

## 2. Invocazione Workflow dal Backend

### **Servizio Principale**
**File:** `lib/workflow-executor.ts:323-440`

**Funzione Export:**
```typescript
export async function executeWorkflow(
  workflowId: string,
  userId: string,
  initialInput: string
): Promise<WorkflowExecution>
```

### **Punto di Chiamata**
**File:** `app/api/chat/route.ts:499-520`

```typescript
if (useWorkflow && workflowToUse) {
  // Esegui il workflow
  console.log(`Eseguendo workflow: ${workflowToUse.name} (ID: ${workflowToUse.id})`);
  
  const workflowExecution = await executeWorkflow(
    workflowToUse.id,  // ID workflow
    userId,            // ID utente
    fullMessage        // Input iniziale (messaggio + eventuali allegati)
  );
  
  if (workflowExecution.success) {
    content = getWorkflowFinalOutput(workflowExecution);
    // ... gestione risposta ...
  }
}
```

### **Flusso Esecuzione**
1. **Caricamento workflow** dal DB (nodes + edges)
2. **Caricamento provider LLM** attivi
3. **Esecuzione sequenziale nodi** seguendo edges
4. **Salvataggio log** in `WorkflowExecutionLog`

### **Tipi Nodo Supportati**
- `input` - Nodo iniziale
- `output` - Nodo finale
- `llm` - Chiamata LLM (OpenAI/Claude)
- `rag` - Query RAG con hybrid retrieval
- `test` - Validazione/debug (no LLM call)

---

## 3. Recupero Dati Conversazione

### **Schema Database**
**File:** `prisma/schema.prisma:108-120`

```prisma
model Message {
  id             String      @id @default(cuid())
  conversationId String
  role           MessageRole // USER | ASSISTANT
  content        String      @db.Text
  tokensIn       Int?
  tokensOut      Int?
  llmProvider    String?
  attachments    Json?      // ⭐ Metadata allegati (filename, size, preview, ecc.)
  createdAt      DateTime    @default(now())
  
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

### **Query Esempio**

#### **A) Ultimo Messaggio Utente**
```typescript
const lastUserMessage = await prisma.message.findFirst({
  where: {
    conversationId: conversationId,
    role: 'USER'
  },
  orderBy: { createdAt: 'desc' }
});
// lastUserMessage.content - Testo completo
// lastUserMessage.attachments - Metadata file allegati
```

#### **B) Ultima Risposta AI**
```typescript
const lastAIMessage = await prisma.message.findFirst({
  where: {
    conversationId: conversationId,
    role: 'ASSISTANT'
  },
  orderBy: { createdAt: 'desc' }
});
// lastAIMessage.content - Risposta AI
// lastAIMessage.llmProvider - Provider usato (OpenAI/Claude)
```

#### **C) Attachment Preview**
**Location generazione:** `app/api/chat/route.ts:451-478`

```typescript
if (file && fileExtractionResult) {
  attachmentMeta = {
    ...fileExtractionResult.metadata,  // filename, mimeType, sizeBytes, extractedChars
    previewChars: preview.length,
    isTruncated: fileExtractionResult.text.length > ATTACHMENT_MAX_CHARS
  };
}

// Salvato in Message.attachments come Json
await prisma.message.create({
  data: {
    // ...
    attachments: attachmentMeta ? [attachmentMeta] : undefined,
  }
});
```

**Struttura attachments:**
```typescript
interface AttachmentMetadata {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractedChars: number;
  uploadedAt: string;
  previewChars: number;
  isTruncated: boolean;
}
```

#### **D) Citazioni RAG**
**⚠️ LIMITAZIONE ATTUALE:** Le citazioni RAG sono incorporate direttamente nel `content` testuale.

**Location formato:** `lib/workflow-executor.ts:169-174`

```typescript
const contextText = contexts.map((ctx, i) => 
  `[Fonte ${i + 1}: ${ctx.filename} - Score: ${ctx.score.toFixed(3)}]\n${ctx.content}`
).join('\n\n---\n\n');

step.output = `[RAG Query: "${input}"]\n\nContesti rilevanti trovati (${contexts.length}):\n\n${contextText}`;
```

**Proposta Miglioramento:**
Aggiungere campo `ragSources: Json?` al model Message per separare citazioni dal content:

```typescript
interface RagSource {
  filename: string;
  score: number;
  chunkId: string;
  content: string;
}
```

---

## 4. UI/Admin Area per Gestione Entità

### **Admin Areas Esistenti**
**Base path:** `/app/dashboard/admin/`

**Sezioni disponibili:**
- ✅ `/file-limits` - Gestione limiti upload per piano
- ✅ `/monitoring` - Monitoraggio sistema
- ✅ `/plans` - Gestione piani abbonamento
- ✅ `/providers` - Configurazione provider LLM
- ✅ `/rag` - Gestione knowledge base RAG
- ✅ `/users` - Gestione utenti
- ✅ `/user-management` - Admin user management
- ✅ `/workflows` - Editor workflow visuali

### **❌ NON ESISTE:** UI per gestione Ticket/Casi

### **Proposta UI Minima per Cases/Tickets**

**Nuovo path:** `/app/dashboard/admin/cases/page.tsx`

**Funzionalità minimali:**
1. **Lista casi** con filtri (stato, priorità, assegnatario)
2. **Dettaglio caso** con:
   - Conversazione originale (link)
   - Messaggi utente/AI
   - Note interne operatore
   - Assegnazione esperto
   - Cambio stato (open → in_review → resolved → closed)
3. **Creazione manuale caso** (opzionale, se serve escalation manuale)

**Protezione:**
- Middleware esistente: `auth()` con check `user.role === 'ADMIN'`
- File: `app/dashboard/admin/layout.tsx` già gestisce protezione admin

**Template UI suggerito:**
```typescript
// app/dashboard/admin/cases/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CaseList } from "@/components/admin/cases/case-list";

export default async function CasesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  // ... fetch casi dal DB ...
  
  return <CaseList cases={cases} />;
}
```

---

## 5. Tabella/Entità Case/Ticket

### **❌ NON ESISTE** nel Database Corrente

**Verifica schema:** `prisma/schema.prisma` - Nessun model `Case`, `Ticket`, `ExpertReview`

### **Schema Minimale Proposto**

```prisma
enum CaseStatus {
  OPEN          // Caso appena creato, in attesa di assegnazione
  IN_REVIEW     // Assegnato a esperto, in lavorazione
  PENDING_USER  // In attesa risposta utente
  RESOLVED      // Risolto da esperto
  CLOSED        // Chiuso definitivamente
}

enum CasePriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Case {
  id        String   @id @default(cuid())
  
  // Relazione conversazione originale
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  // Utente che ha richiesto supporto
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Assegnazione esperto (nullable se non ancora assegnato)
  assignedToId String?
  assignedTo   User?   @relation("AssignedCases", fields: [assignedToId], references: [id])
  
  // Metadati caso
  title       String   // Titolo caso (auto-generato o manuale)
  description String?  @db.Text // Descrizione problema (opzionale)
  
  status      CaseStatus   @default(OPEN)
  priority    CasePriority @default(MEDIUM)
  
  // Trigger automatico (es: keyword detection, utente richiede esperto)
  triggeredBy String?  // 'user_request' | 'auto_keyword' | 'admin_manual'
  
  // Note interne per operatori
  internalNotes String? @db.Text
  
  // Timestamp
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  resolvedAt  DateTime? // Quando status → RESOLVED
  closedAt    DateTime? // Quando status → CLOSED
  
  // Relazione messaggi del caso (opzionale, se serve history separata)
  caseMessages CaseMessage[]
  
  @@index([status, priority]) // Per query filtrate
  @@index([assignedToId])     // Per query "miei casi"
  @@index([userId])           // Per query "casi utente X"
}

// Messaggi specifici del caso (comunicazioni interne esperto-utente)
model CaseMessage {
  id        String   @id @default(cuid())
  caseId    String
  case      Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  
  authorId  String   // User o Admin che ha scritto
  author    User     @relation(fields: [authorId], references: [id])
  
  content   String   @db.Text
  isInternal Boolean @default(false) // true = nota interna, false = risposta a utente
  
  createdAt DateTime @default(now())
  
  @@index([caseId])
}
```

### **Relazioni con Modelli Esistenti**

**Modifiche a model User:**
```prisma
model User {
  // ... campi esistenti ...
  
  // Casi creati dall'utente
  casesCreated Case[]
  
  // Casi assegnati (solo per ADMIN/EXPERT)
  casesAssigned Case[] @relation("AssignedCases")
  
  // Messaggi caso
  caseMessages CaseMessage[]
}
```

**Modifiche a model Conversation:**
```prisma
model Conversation {
  // ... campi esistenti ...
  
  // Caso associato (se escalato a esperto)
  cases Case[]
}
```

### **Integrazione nel Workflow**

**Punto di trigger:** `app/api/chat/route.ts` dopo esecuzione workflow

```typescript
// Dopo workflowExecution, check per keyword o richiesta esplicita
if (shouldCreateCase(content, fullMessage)) {
  await prisma.case.create({
    data: {
      conversationId: conversation.id,
      userId: userId,
      title: generateCaseTitle(fullMessage),
      status: 'OPEN',
      priority: detectPriority(fullMessage),
      triggeredBy: detectTriggerSource(fullMessage), // 'user_request' | 'auto_keyword'
    }
  });
}
```

---

## 📊 Riepilogo Stato Attuale

| Componente | Stato | Location | Note |
|------------|-------|----------|------|
| **Workflow globali** | ✅ Esiste | `schema.prisma:51` | `userId = null`, `isDefault = true` |
| **Executor workflow** | ✅ Esiste | `lib/workflow-executor.ts:323` | Funzione `executeWorkflow()` |
| **Recupero messaggi** | ✅ Esiste | `schema.prisma:108-120` | Model `Message` con `attachments: Json` |
| **Citazioni RAG** | ⚠️ Parziale | `lib/workflow-executor.ts:169` | Incorporate in `content`, non strutturate |
| **UI Admin cases** | ❌ Non esiste | - | Proposta: `/admin/cases` |
| **Tabella Case** | ❌ Non esiste | - | Proposta schema completo sopra |

---

## 🎯 Prossimi Passi Implementazione

### **Fase 1: Database (1-2h)**
1. Aggiungere model `Case` e `CaseMessage` allo schema Prisma
2. Creare migration: `npx prisma migrate dev --name add_case_system`
3. Rigenerare Prisma Client

### **Fase 2: API Routes (2-3h)**
1. `POST /api/admin/cases` - Creazione caso (auto o manuale)
2. `GET /api/admin/cases` - Lista casi con filtri
3. `GET /api/admin/cases/[id]` - Dettaglio caso
4. `PATCH /api/admin/cases/[id]` - Aggiornamento stato/assegnazione
5. `POST /api/admin/cases/[id]/messages` - Aggiungi messaggio

### **Fase 3: UI Admin (3-4h)**
1. `/admin/cases` - Lista casi (table con filtri)
2. `/admin/cases/[id]` - Dettaglio caso (timeline, assegnazione, note)
3. Componenti: `CaseList`, `CaseDetail`, `CaseStatusBadge`, `AssignExpertDropdown`

### **Fase 4: Trigger Automatici (2-3h)**
1. Keyword detection in `app/api/chat/route.ts`
2. Pulsante "Richiedi Esperto" nella chat UI
3. Auto-assegnazione basata su carico lavoro

### **Fase 5: Notifiche (opzionale, 1-2h)**
1. Email a esperto quando caso assegnato
2. Notifica utente quando caso risolto
3. Badge UI per nuovi casi non assegnati

---

## 🔒 Note Sicurezza

- **Protezione admin:** Tutti gli endpoint `/api/admin/cases/*` devono verificare `session.user.role === 'ADMIN'`
- **Isolamento dati:** Utenti normali possono vedere solo i propri casi
- **Audit log:** Considerare aggiungere `CaseAuditLog` per tracciare modifiche (chi ha cambiato stato/assegnazione/priority)

---

**Fine Assessment Tecnico**
