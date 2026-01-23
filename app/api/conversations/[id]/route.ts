import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// Funzione per gestire le richieste DELETE
export async function DELETE(
  request: NextRequest, 
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse('Non autorizzato', { status: 401 });
  }

  const { id } = await ctx.params;
  const conversationId = id;

  if (!conversationId) {
    return new NextResponse('ID conversazione mancante', { status: 400 });
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return new NextResponse('Conversazione non trovata o non autorizzata', { status: 404 });
    }

    await prisma.conversation.delete({
      where: {
        id: conversationId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[CONVERSATION_DELETE]', error);
    return new NextResponse('Errore interno del server', { status: 500 });
  }
}

// Funzione per gestire le richieste PUT
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const conversationId = id;
  if (!conversationId) {
    return NextResponse.json({ error: 'ID conversazione mancante' }, { status: 400 });
  }

  let newTitle;
  try {
    const body = await req.json();
    newTitle = body.title;
    if (typeof newTitle !== 'string' || newTitle.trim() === '') {
      return NextResponse.json({ error: 'Titolo non valido' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Richiesta JSON non valida' }, { status: 400 });
  }

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 });
    }

    if (conversation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: newTitle.trim() },
    });

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error("Errore durante l'aggiornamento del titolo:", error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
