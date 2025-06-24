// app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Importa la funzione auth
import prisma from '@/lib/prisma'; // Importa l'istanza Prisma centralizzata

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    const baseTitle = "Nuova Consulenza";

    // Trova le conversazioni esistenti con un titolo simile
    const existingConversations = await prisma.conversation.findMany({
      where: {
        userId: session.user.id,
        title: {
          startsWith: baseTitle,
        },
      },
      select: {
        title: true,
      },
    });

    let newTitle = baseTitle;
    if (existingConversations.length > 0) {
      const existingTitles = existingConversations.map(c => c.title);
      let counter = 1;
      // Continua a incrementare il contatore finché non trovi un titolo univoco
      while (true) {
        counter++;
        const prospectiveTitle = `${baseTitle} (${counter})`;
        if (!existingTitles.includes(prospectiveTitle)) {
          newTitle = prospectiveTitle;
          break;
        }
      }
    }

    const newConversation = await prisma.conversation.create({
      data: {
        userId: session.user.id,
        title: newTitle,
      },
    });

    return NextResponse.json(newConversation, { status: 201 }); // 201 Created
  } catch (error) {
    console.error('Errore nella creazione della conversazione:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

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
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Errore nel recuperare le conversazioni:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
