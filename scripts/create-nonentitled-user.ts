import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.NONENTITLED_EMAIL || 'nonentitled@test.local';
  const password = process.env.NONENTITLED_PASSWORD;

  if (!password) {
    throw new Error('Missing env NONENTITLED_PASSWORD');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: Role.CUSTOMER,
      isBlocked: false,
    },
    create: {
      email,
      password: hashedPassword,
      role: Role.CUSTOMER,
      name: 'Non Entitled (Smoke Test)',
      isBlocked: false,
    },
    select: { id: true, email: true },
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      status: 'canceled',
      currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
      trialEnd: null,
      maxFileBytes: 10485760,
      maxAttachmentChars: 25000,
    },
    create: {
      userId: user.id,
      status: 'canceled',
      currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
      trialEnd: null,
      maxFileBytes: 10485760,
      maxAttachmentChars: 25000,
      tokenLimit: 10000,
    },
    select: { id: true, status: true },
  });

  console.log(`✅ Non-entitled user ready: ${user.email}`);
}

main()
  .catch((err) => {
    console.error('❌ create-nonentitled-user failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
