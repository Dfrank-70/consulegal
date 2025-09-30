import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Inizializzazione sistema workflow...');

  // 1. Crea provider LLM di default
  console.log('📦 Creazione provider LLM...');
  
  const openaiProvider = await prisma.lLMProvider.upsert({
    where: { name: 'OpenAI' },
    update: {},
    create: {
      name: 'OpenAI',
      apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
      isActive: true,
      config: {
        baseURL: 'https://api.openai.com/v1',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
        defaultModel: 'gpt-3.5-turbo'
      }
    }
  });

  const claudeProvider = await prisma.lLMProvider.upsert({
    where: { name: 'Claude' },
    update: {},
    create: {
      name: 'Claude',
      apiKey: 'placeholder-key',
      isActive: false,
      config: {
        baseURL: 'https://api.anthropic.com/v1',
        models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'],
        defaultModel: 'claude-3-haiku'
      }
    }
  });
  console.log(`✅ Provider creati: ${openaiProvider.name}, ${claudeProvider.name}`);

  // 2. Crea workflow di default
  console.log('🔄 Creazione workflow di default...');
  
  let defaultWorkflow = await prisma.workflow.findFirst({
    where: { isDefault: true }
  });

  if (!defaultWorkflow) {
    console.log('...Nessun workflow di default trovato, ne creo uno...');
    defaultWorkflow = await prisma.workflow.create({
      data: {
        name: 'Traspolegal Default',
        description: 'Workflow di default per analisi legale con Traspolegal',
        isDefault: true,
        nodes: {
          create: [
            {
              nodeId: 'input-1',
              type: 'input',
              position: { x: 100, y: 100 },
              data: { label: 'Input Utente' }
            },
            {
              nodeId: 'llm-1',
              type: 'llm',
              position: { x: 300, y: 100 },
              data: {
                provider: 'OpenAI',
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                maxTokens: 1000,
                customInstruction: 'Sei Traspolegal, un assistente legale virtuale per professionisti del mercato italiano. Rispondi in modo chiaro, preciso e formale.',
                prompt: `--- ISTRUZIONI OPERATIVE ---\n\n1. **GESTIONE FILE ALLEGATI:** Quando l'utente allega un file (PDF, DOC, DOCX), il contenuto viene sempre estratto automaticamente e incluso nel messaggio. Analizza SEMPRE il contenuto del file allegato insieme alla richiesta dell'utente e fornisci una consulenza completa e dettagliata.\n\n2. **STILE DI RISPOSTA:** Fornisci risposte professionali, ben strutturate e complete. Usa un linguaggio tecnico appropriato ma comprensibile.\n\n3. **ANALISI DOCUMENTALE:** Se viene allegato un documento, analizzalo approfonditamente e fornisci osservazioni specifiche sul contenuto, evidenziando aspetti legali rilevanti.`
              }
            },
            {
              nodeId: 'output-1',
              type: 'output',
              position: { x: 500, y: 100 },
              data: { label: 'Risposta Finale' }
            }
          ]
        },
        edges: {
          create: [
            {
              edgeId: 'edge-1',
              sourceId: 'input-1',
              targetId: 'llm-1',
              data: {}
            },
            {
              edgeId: 'edge-2',
              sourceId: 'llm-1',
              targetId: 'output-1',
              data: {}
            }
          ]
        }
      }
    });
    console.log(`✅ Workflow di default creato: ${defaultWorkflow.name}`);
  } else {
    console.log('✅ Workflow di default già esistente');
  }

  // 3. Crea workflow avanzato di esempio
  console.log('🔄 Creazione workflow avanzato di esempio...');
  
  let advancedWorkflow = await prisma.workflow.findFirst({
    where: { name: 'Analisi Fiscale Avanzata' }
  });

  if (!advancedWorkflow) {
    console.log('...Nessun workflow avanzato trovato, ne creo uno...');
    advancedWorkflow = await prisma.workflow.create({
      data: {
        name: 'Analisi Fiscale Avanzata',
        description: 'Workflow multi-step per analisi fiscale complessa',
        isDefault: false,
        nodes: {
          create: [
            {
              nodeId: 'input-2',
              type: 'input',
              position: { x: 50, y: 200 },
              data: { label: 'Input Utente' }
            },
            {
              nodeId: 'llm-2',
              type: 'llm',
              position: { x: 250, y: 150 },
              data: {
                provider: 'OpenAI',
                model: 'gpt-3.5-turbo',
                temperature: 0.3,
                maxTokens: 800,
                customInstruction: 'Sei un esperto in diritto tributario italiano.',
                prompt: 'Analizza dal punto di vista fiscale il documento o la situazione presentata. Identifica i principali aspetti tributari e le normative applicabili.'
              }
            },
            {
              nodeId: 'llm-3',
              type: 'llm',
              position: { x: 250, y: 250 },
              data: {
                provider: 'OpenAI',
                model: 'gpt-3.5-turbo',
                temperature: 0.5,
                maxTokens: 600,
                customInstruction: 'Sei un consulente fiscale pratico.',
                prompt: 'Basandoti sull\'analisi precedente, fornisci consigli pratici e raccomandazioni operative per ottimizzare la situazione fiscale.'
              }
            },
            {
              nodeId: 'output-2',
              type: 'output',
              position: { x: 450, y: 200 },
              data: { label: 'Consulenza Completa' }
            }
          ]
        },
        edges: {
          create: [
            {
              edgeId: 'edge-3',
              sourceId: 'input-2',
              targetId: 'llm-2',
              data: {}
            },
            {
              edgeId: 'edge-4',
              sourceId: 'llm-2',
              targetId: 'llm-3',
              data: {
                instruction: 'Passa l\'analisi fiscale al nodo successivo per i consigli pratici'
              }
            },
            {
              edgeId: 'edge-5',
              sourceId: 'llm-3',
              targetId: 'output-2',
              data: {}
            }
          ]
        }
      }
    });
    console.log(`✅ Workflow avanzato creato: ${advancedWorkflow.name}`);
  } else {
    console.log('✅ Workflow avanzato già esistente');
  }

  // 4. Verifica che ci sia almeno un utente admin
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });

  if (!adminUser) {
    console.log('⚠️  Nessun utente admin trovato. Assicurati di avere almeno un utente con ruolo ADMIN per accedere al pannello.');
  } else {
    console.log(`✅ Utente admin trovato: ${adminUser.email}`);
  }

  console.log('\n🎉 Sistema workflow inizializzato con successo!');
  console.log('\n📋 Riepilogo:');
  console.log(`- Provider LLM: 2 (OpenAI attivo, Claude inattivo)`);
  console.log(`- Workflow: 2 (1 default, 1 avanzato)`);
  console.log(`- Nodi totali: 7`);
  console.log(`- Connessioni totali: 5`);
  console.log('\n🚀 Puoi ora accedere al pannello admin su /admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
