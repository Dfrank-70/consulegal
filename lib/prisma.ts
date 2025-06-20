// /Users/francescogarofano/consulegal/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // Permetti a 'prisma' di essere una variabile globale in sviluppo
  // per evitare di creare nuove istanze con ogni hot reload.
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;
