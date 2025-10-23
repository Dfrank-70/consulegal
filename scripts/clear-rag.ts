// scripts/clear-rag.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();
const RAG_DATA_PATH = path.join(process.cwd(), 'ragdata');

async function main() {
  console.log('🧹 Starting RAG cleanup...');

  // 1. Delete database records
  console.log('🗑️  Deleting database records...');
  // The order is important due to foreign key constraints
  await prisma.ragEmbedding.deleteMany({});
  console.log('  - Embeddings deleted.');
  await prisma.ragChunk.deleteMany({});
  console.log('  - Chunks deleted.');
  await prisma.ragDocument.deleteMany({});
  console.log('  - Documents deleted.');
  await prisma.ragNode.deleteMany({});
  console.log('  - Nodes deleted.');
  console.log('✅ Database records cleared successfully.');

  // 2. Delete filesystem data
  console.log('🗂️  Deleting filesystem data from ragdata/ directory...');
  try {
    const items = await fs.readdir(RAG_DATA_PATH);
    for (const item of items) {
      const itemPath = path.join(RAG_DATA_PATH, item);
      // A safety check to not delete hidden files like .gitkeep
      if (!item.startsWith('.')) {
        await fs.rm(itemPath, { recursive: true, force: true });
        console.log(`  - Deleted: ${item}`);
      }
    }
    console.log('✅ Filesystem data cleared successfully.');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('🟡 ragdata/ directory not found, skipping filesystem cleanup.');
    } else {
      console.error('❌ Error deleting filesystem data:', error);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ A critical error occurred during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('✨ Cleanup complete.');
  });
