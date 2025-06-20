// app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Importa la funzione auth
import prisma from '@/lib/prisma'; // Importa l'istanza Prisma centralizzata

export async function GET(request: NextRequest) {
  const session = await auth(); // Usa la funzione auth() per ottenere la sessione

  if (!session || !session.user || !session.user.id) { // session.user potrebbe essere null
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('id');

  try {
    // Se viene fornito un ID, trova quella specifica conversazione
    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: {
          id: conversationId,
          userId: userId, // Assicura che l'utente sia il proprietario
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      });

      if (!conversation) {
        return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 });
      }

      return NextResponse.json(conversation);
    }

    // Altrimenti, restituisci tutte le conversazioni dell'utente
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Errore nel recuperare le conversazioni:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
