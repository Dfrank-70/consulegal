const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔧 Aggiorno limiti file per tutti i piani...\n');

  // Mappatura productId → nuovi limiti
  const limitsUpdates = {
    'prod_SX7ZfoHB5tVp24': { // ConsulLight
      maxFileBytes: 1048576,    // 1MB
      maxAttachmentChars: 25000
    },
    'prod_SX7bqwJ5SGERJX': { // ConsulExpert  
      maxFileBytes: 2097152,    // 2MB
      maxAttachmentChars: 50000
    },
    'prod_SX7aNEcKd5SkVl': { // ConsulPro
      maxFileBytes: 3145728,    // 3MB
      maxAttachmentChars: 75000
    }
  };

  for (const [productId, limits] of Object.entries(limitsUpdates)) {
    console.log(`📦 Aggiornando ${productId}:`);
    console.log(`   - Max File: ${(limits.maxFileBytes / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   - Max Char: ${limits.maxAttachmentChars.toLocaleString()}`);
    
    const result = await prisma.subscription.updateMany({
      where: { stripeProductId: productId },
      data: limits
    });
    
    console.log(`   ✅ Aggiornati ${result.count} abbonamenti\n`);
  }

  // Verifica finale
  const updated = await prisma.subscription.findMany({
    select: {
      stripeProductId: true,
      maxFileBytes: true,
      maxAttachmentChars: true,
      user: { select: { email: true } }
    },
    orderBy: { stripeProductId: 'asc' }
  });

  console.log('📊 Verifica finale:');
  const grouped = {};
  updated.forEach(sub => {
    const key = sub.stripeProductId;
    if (!grouped[key]) {
      grouped[key] = { 
        productId: key, 
        maxFileBytes: sub.maxFileBytes, 
        maxChars: sub.maxAttachmentChars, 
        users: [] 
      };
    }
    grouped[key].users.push(sub.user.email);
  });

  Object.values(grouped).forEach(group => {
    console.log(`   ${group.productId}:`);
    console.log(`     - ${(group.maxFileBytes / 1024 / 1024).toFixed(1)}MB, ${group.maxChars.toLocaleString()} char`);
    console.log(`     - ${group.users.length} utenti`);
  });

  await prisma.$disconnect();
  console.log('\n✅ Aggiornamento completato!');
})();
