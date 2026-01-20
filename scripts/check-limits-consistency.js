const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🔍 Verifico consistenza limiti per productId...\n');

  const subscriptions = await prisma.subscription.findMany({
    select: {
      stripeProductId: true,
      maxFileBytes: true,
      maxAttachmentChars: true,
      tokenLimit: true,
      user: { select: { email: true } }
    },
    orderBy: { stripeProductId: 'asc' }
  });

  // Raggruppa per productId
  const grouped = {};
  subscriptions.forEach(sub => {
    const key = sub.stripeProductId || 'no-plan';
    if (!grouped[key]) {
      grouped[key] = {
        productId: key,
        limits: {},
        users: []
      };
    }
    
    const limitKey = `${sub.maxFileBytes}_${sub.maxAttachmentChars}_${sub.tokenLimit}`;
    if (!grouped[key].limits[limitKey]) {
      grouped[key].limits[limitKey] = [];
    }
    grouped[key].limits[limitKey].push(sub.user.email);
    grouped[key].users.push(sub.user.email);
  });

  Object.entries(grouped).forEach(([productId, data]) => {
    console.log(`📦 ${productId}:`);
    Object.entries(data.limits).forEach(([limitKey, users]) => {
      const [fileBytes, chars, tokens] = limitKey.split('_');
      console.log(`   - ${(parseInt(fileBytes) / 1024 / 1024).toFixed(1)}MB, ${parseInt(chars).toLocaleString()} char, ${parseInt(tokens).toLocaleString()} token`);
      console.log(`     Utenti: ${users.slice(0, 3).join(', ')}${users.length > 3 ? ` (+${users.length - 3})` : ''}`);
    });
    console.log('');
  });

  // Test API call
  console.log('🌐 Test API call...');
  try {
    const response = await fetch('http://localhost:3000/api/admin/subscriptions');
    const data = await response.json();
    
    console.log('📊 Dati dall\'API:');
    Object.entries(data.planGroups).forEach(([key, plan]) => {
      console.log(`   ${key}: ${(plan.maxFileBytes / 1024 / 1024).toFixed(1)}MB, ${plan.maxAttachmentChars.toLocaleString()} char`);
    });
  } catch (error) {
    console.log('❌ API non raggiungibile - server non attivo?');
  }

  await prisma.$disconnect();
})();
