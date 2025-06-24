import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  console.log('Deleting old plans...');
  await prisma.plan.deleteMany({}); // Delete all existing plans

  console.log('Creating new plans...');
  await prisma.plan.create({
    data: {
      name: 'ConsulLight',
      price: 9.99,
      description: 'Ideale per iniziare e per un uso sporadico.',
      features: [
        'Accesso a tutti i modelli di IA',
        '50 richieste al mese',
        'Cronologia conversazioni',
        'Supporto via email',
      ],
      stripePriceId: 'price_1Rc3KZIe4PsbLJO4f9Ol0Cvs',
      isActive: true,
    },
  });

  await prisma.plan.create({
    data: {
      name: 'ConsulPro',
      price: 29.00,
      description: 'Perfetto per professionisti e un uso regolare.',
      features: [
        'Tutti i vantaggi del piano Light',
        '200 richieste al mese',
        'Istruzioni personalizzate per l\u2019IA',
        'Supporto prioritario',
      ],
      stripePriceId: 'price_1Rc3LFIe4PsbLJO4nLFy2p3i',
      isActive: true,
    },
  });

  await prisma.plan.create({
    data: {
      name: 'ConsulExpert',
      price: 79.99,
      description: 'La soluzione completa per aziende e power user.',
      features: [
        'Tutti i vantaggi del piano Pro',
        'Richieste illimitate',
        'Accesso anticipato a nuove funzioni',
        'API per integrazioni personalizzate',
      ],
      stripePriceId: 'price_1Rc3LpIe4PsbLJO4ETiGG41d',
      isActive: true,
    },
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
