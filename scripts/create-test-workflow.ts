import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Creazione workflow di test...');

  // Verifica se esiste già
  const existing = await prisma.workflow.findFirst({
    where: { name: 'Test Upload File' }
  });

  if (existing) {
    console.log('⚠️  Workflow "Test Upload File" già esistente. Eliminazione...');
    await prisma.workflow.delete({ where: { id: existing.id } });
  }

  // Crea il workflow
  const workflow = await prisma.workflow.create({
    data: {
      name: 'Test Upload File',
      description: 'Workflow per validare upload di file senza chiamare LLM. Mostra statistiche token e preview contenuto.',
      isDefault: false,
      nodes: {
        create: [
          {
            nodeId: 'input-1',
            type: 'input',
            position: { x: 100, y: 200 },
            data: {}
          },
          {
            nodeId: 'test-1',
            type: 'test',
            position: { x: 350, y: 200 },
            data: {}
          },
          {
            nodeId: 'output-1',
            type: 'output',
            position: { x: 600, y: 200 },
            data: {}
          }
        ]
      },
      edges: {
        create: [
          {
            edgeId: 'edge-1',
            sourceId: 'input-1',
            targetId: 'test-1',
            data: {}
          },
          {
            edgeId: 'edge-2',
            sourceId: 'test-1',
            targetId: 'output-1',
            data: {}
          }
        ]
      }
    },
    include: {
      nodes: true,
      edges: true
    }
  });

  console.log('✅ Workflow creato con successo!');
  console.log(`   ID: ${workflow.id}`);
  console.log(`   Nome: ${workflow.name}`);
  console.log(`   Nodi: ${workflow.nodes.length}`);
  console.log(`   Connessioni: ${workflow.edges.length}`);
  console.log('');
  console.log('📋 Per assegnare il workflow a un utente:');
  console.log('   1. Vai su /dashboard/admin/workflows');
  console.log('   2. Clicca su "Assegna a utenti"');
  console.log('   3. Seleziona gli utenti desiderati');
}

main()
  .catch((e) => {
    console.error('❌ Errore:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
