const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🗑️ Cancello tutte le consulenze...\n');

  try {
    // Prima cancello tutti i messaggi
    const messagesResult = await prisma.message.deleteMany({});
    console.log(`✅ Cancellati ${messagesResult.count} messaggi`);

    // Poi cancello tutte le conversazioni
    const conversationsResult = await prisma.conversation.deleteMany({});
    console.log(`✅ Cancellate ${conversationsResult.count} conversazioni`);

    // Verifica finale
    const remainingMessages = await prisma.message.count();
    const remainingConversations = await prisma.conversation.count();

    console.log('\n📊 Verifica finale:');
    console.log(`   Messaggi rimanenti: ${remainingMessages}`);
    console.log(`   Conversazioni rimanenti: ${remainingConversations}`);

    if (remainingMessages === 0 && remainingConversations === 0) {
      console.log('\n✅ Tutte le consulenze sono state cancellate con successo!');
    } else {
      console.log('\n⚠️ Alcune consulenze potrebbero non essere state cancellate.');
    }

  } catch (error) {
    console.error('❌ Errore durante la cancellazione:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
