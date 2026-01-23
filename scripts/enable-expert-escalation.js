const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        name: { not: { startsWith: 'system_' } },
        OR: [
          { isDefault: true },
          { users: { some: {} } },
        ],
      },
      select: { id: true, name: true, allowExpertEscalation: true },
    });

    const toUpdate = workflows.filter((w) => !w.allowExpertEscalation);

    if (toUpdate.length === 0) {
      console.log('No workflows to update (allowExpertEscalation already enabled).');
      return;
    }

    await prisma.workflow.updateMany({
      where: { id: { in: toUpdate.map((w) => w.id) } },
      data: { allowExpertEscalation: true },
    });

    console.log('Updated workflows (allowExpertEscalation=true):');
    for (const w of toUpdate) {
      console.log(`- ${w.id} ${w.name}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
