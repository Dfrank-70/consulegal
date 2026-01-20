const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const email = 'pippo@kennedyi.it';
  
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.log('❌ Utente non trovato');
    await prisma.$disconnect();
    return;
  }

  // Cancella token usage di oggi
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const deleted = await prisma.tokenUsage.deleteMany({
    where: {
      userId: user.id,
      date: { gte: todayStart, lte: todayEnd }
    }
  });

  console.log(`✅ Reset token per ${email}`);
  console.log(`   Cancellati ${deleted.count} record di oggi`);
  console.log(`   Limite giornaliero: 10,000 token`);
  console.log(`   Token disponibili: 10,000 token`);

  await prisma.$disconnect();
})();
