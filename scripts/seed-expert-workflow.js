const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Crea workflow globale "system_expert_packet_v1" per generare dossier esperti
 * 
 * Input atteso: JSON con { user_message, ai_draft, attachments, extracted_citations }
 * Output: JSON strutturato con campi per l'esperto
 */
async function seedExpertWorkflow() {
  console.log('🔧 Seed workflow system_expert_packet_v1...\n');

  try {
    // Verifica se esiste già
    const existing = await prisma.workflow.findFirst({
      where: { 
        name: 'system_expert_packet_v1',
        userId: null // workflow globale
      }
    });

    if (existing) {
      console.log('⚠️  Workflow system_expert_packet_v1 già esistente.');
      console.log(`   ID: ${existing.id}`);
      console.log(`   Descrizione: ${existing.description || 'N/A'}`);
      return existing.id;
    }

    // Crea workflow globale
    const workflow = await prisma.workflow.create({
      data: {
        name: 'system_expert_packet_v1',
        description: 'Workflow di sistema per generare dossier strutturato destinato agli esperti legali',
        userId: null, // Globale (sistema)
        isDefault: false, // Non è il default per utenti normali
        nodes: {
          create: [
            // Nodo 1: Input (riceve JSON payload)
            {
              nodeId: 'input-1',
              type: 'input',
              position: { x: 100, y: 100 },
              data: {
                label: 'Input Caso'
              }
            },
            // Nodo 2: LLM per analisi e creazione dossier
            {
              nodeId: 'llm-expert-analyzer',
              type: 'llm',
              position: { x: 400, y: 100 },
              data: {
                provider: 'OpenAI',
                model: 'gpt-4o-mini',
                temperature: 0.3, // Bassa temperatura per output strutturato
                maxTokens: 2000,
                customInstruction: `Sei un assistente legale specializzato nell'analisi di casi per esperti.

COMPITO:
Ricevi un payload JSON con:
- user_message: domanda/richiesta originale dell'utente
- ai_draft: risposta bozza generata dall'AI
- attachments: eventuali documenti allegati (metadata)
- extracted_citations: citazioni/fonti RAG presenti nella risposta

Devi produrre un dossier strutturato in formato JSON con i seguenti campi:

{
  "summary": "Riassunto del caso in 2-3 frasi",
  "facts": ["fatto 1", "fatto 2", ...],
  "user_question": "Domanda principale dell'utente estratta",
  "ai_draft_quality": "Valutazione qualità risposta AI (low/medium/high)",
  "missing_info_questions": ["domanda 1 da fare all'utente", "domanda 2", ...],
  "risk_level": "low/medium/high",
  "citations": ["citazione 1", "citazione 2", ...],
  "draft_answer": "Risposta bozza AI (riassunta)",
  "expert_actions": ["azione suggerita 1", "azione 2", ...],
  "notes_for_expert": "Note aggiuntive per l'esperto umano"
}

REGOLE:
- Output SOLO JSON valido, niente testo extra
- summary max 200 caratteri
- facts: lista concisa di fatti verificabili
- missing_info_questions: cosa chiedere all'utente per completare l'analisi
- risk_level basato su complessità legale e potenziali conseguenze
- citations: estrarre e validare citazioni dalla risposta AI
- expert_actions: cosa dovrebbe fare l'esperto (es: "Verificare normativa X", "Richiedere documento Y")
- notes_for_expert: contesto rilevante per revisione umana

OUTPUT: Ritorna SOLO il JSON, senza \`\`\`json o altro markup.`
              }
            },
            // Nodo 3: Output (restituisce dossier)
            {
              nodeId: 'output-1',
              type: 'output',
              position: { x: 700, y: 100 },
              data: {
                label: 'Dossier Esperto'
              }
            }
          ]
        },
        edges: {
          create: [
            // Input -> LLM
            {
              edgeId: 'edge-1',
              sourceId: 'input-1',
              targetId: 'llm-expert-analyzer'
            },
            // LLM -> Output
            {
              edgeId: 'edge-2',
              sourceId: 'llm-expert-analyzer',
              targetId: 'output-1'
            }
          ]
        }
      }
    });

    console.log('✅ Workflow system_expert_packet_v1 creato con successo!');
    console.log(`   ID: ${workflow.id}`);
    console.log(`   Nodi: 3 (input → llm → output)`);
    console.log(`   Provider: OpenAI GPT-4o-mini`);
    console.log(`   Output: JSON strutturato per esperti\n`);

    return workflow.id;

  } catch (error) {
    console.error('❌ Errore durante seed workflow:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Esegui seed se chiamato direttamente
if (require.main === module) {
  seedExpertWorkflow()
    .then((workflowId) => {
      console.log(`\n📋 Workflow ID da usare in /api/cases/request-expert:`);
      console.log(`   ${workflowId}\n`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedExpertWorkflow };
