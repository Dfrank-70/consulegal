import prisma from '../lib/prisma';

async function createEmptyRagNode() {
  try {
    const ragNode = await prisma.ragNode.create({
      data: {
        name: 'Demo Codice Civile',
        description: 'Nodo RAG per demo MVP - documenti da caricare via UI'
      }
    });
    
    console.log('✅ RAG node created successfully!');
    console.log(`   ID: ${ragNode.id}`);
    console.log(`   Name: ${ragNode.name}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Go to http://localhost:3000/dashboard/admin/rag-test');
    console.log(`   2. Use Node ID: ${ragNode.id}`);
    console.log('   3. Upload PDF/text documents');
    console.log('   4. Create workflow with RAG node pointing to this ID');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createEmptyRagNode();
