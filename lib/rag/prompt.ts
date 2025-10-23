// RAG Prompt Templates with hard grounding and citation requirements

import { RetrievalResult } from './types';

/**
 * Build the system prompt for RAG answering with hard grounding
 */
export function buildSystemPrompt(): string {
  return `Sei un assistente AI specializzato nell'analisi di documenti legali e normativi.

REGOLE FONDAMENTALI:
1. Rispondi SOLO utilizzando le informazioni presenti nel CONTEXT fornito
2. Se il CONTEXT non contiene informazioni sufficienti per rispondere, devi dire esplicitamente: "Non ho trovato informazioni sufficienti nelle fonti fornite per rispondere a questa domanda"
3. NON inventare, dedurre o aggiungere informazioni che non sono esplicitamente presenti nel CONTEXT
4. Cita SEMPRE le fonti usando il formato [Doc: nome_file, pag: X] o [Legge: riferimento] per ogni affermazione

FORMATO CITAZIONI:
- Usa [Doc: filename.pdf, pag: 2] per citare un documento specifico
- Se la pagina non è disponibile, usa [Doc: filename.pdf]
- Per riferimenti normativi: [Legge: Art. 123 del Codice Civile]

STILE DI RISPOSTA:
- Sii preciso, chiaro e professionale
- Usa un linguaggio formale ma comprensibile
- Struttura la risposta in paragrafi quando appropriato
- Evidenzia i punti chiave

Ricorda: la tua credibilità dipende dall'accuratezza delle citazioni e dal rigoroso rispetto del CONTEXT fornito.`;
}

/**
 * Build the user prompt with context and query
 */
export function buildUserPrompt(query: string, contexts: RetrievalResult[]): string {
  if (contexts.length === 0) {
    return `DOMANDA: ${query}

CONTEXT: Nessun documento rilevante trovato.

Rispondi che non hai trovato informazioni sufficienti per rispondere alla domanda.`;
  }

  // Build context section with numbered sources
  const contextSection = contexts
    .map((ctx, idx) => {
      const pageNum = ctx.metadata?.page || estimatePageFromMetadata(ctx);
      const source = pageNum 
        ? `[Doc: ${ctx.filename}, pag: ${pageNum}]`
        : `[Doc: ${ctx.filename}]`;
      
      return `--- FONTE ${idx + 1} ${source} ---
${ctx.content.trim()}
`;
    })
    .join('\n\n');

  return `CONTEXT:
${contextSection}

---

DOMANDA: ${query}

Rispondi alla domanda utilizzando SOLO le informazioni presenti nel CONTEXT sopra. Cita sempre le fonti usando il formato indicato.`;
}

/**
 * Estimate page number from chunk metadata
 */
function estimatePageFromMetadata(ctx: RetrievalResult): number | null {
  if (ctx.metadata?.page) {
    return ctx.metadata.page;
  }
  
  // Rough estimate: 2000 chars per page
  if (ctx.metadata?.startChar) {
    return Math.floor(ctx.metadata.startChar / 2000) + 1;
  }
  
  return null;
}

/**
 * Extract citations from the LLM response
 * Looks for patterns like [Doc: filename, pag: X] or [Legge: ...]
 */
export function extractCitations(text: string, contexts: RetrievalResult[]): Array<{
  documentId: string;
  filename: string;
  page?: number;
  chunkId: string;
  excerpt: string;
}> {
  const citations: Array<{
    documentId: string;
    filename: string;
    page?: number;
    chunkId: string;
    excerpt: string;
  }> = [];

  // Pattern: [Doc: filename.pdf, pag: 2] or [Doc: filename.pdf]
  const docPattern = /\[Doc:\s*([^,\]]+)(?:,\s*pag:\s*(\d+))?\]/gi;
  
  let match;
  while ((match = docPattern.exec(text)) !== null) {
    const filename = match[1].trim();
    const page = match[2] ? parseInt(match[2]) : undefined;

    // Find matching context
    const matchingContext = contexts.find(ctx => 
      ctx.filename.toLowerCase().includes(filename.toLowerCase()) ||
      filename.toLowerCase().includes(ctx.filename.toLowerCase())
    );

    if (matchingContext) {
      // Get excerpt (first 150 chars)
      const excerpt = matchingContext.content.substring(0, 150) + '...';
      
      citations.push({
        documentId: matchingContext.documentId,
        filename: matchingContext.filename,
        page: page || matchingContext.metadata?.page,
        chunkId: matchingContext.chunkId,
        excerpt,
      });
    }
  }

  // Deduplicate citations
  const uniqueCitations = citations.filter((citation, index, self) =>
    index === self.findIndex(c => 
      c.documentId === citation.documentId && 
      c.page === citation.page &&
      c.chunkId === citation.chunkId
    )
  );

  return uniqueCitations;
}
