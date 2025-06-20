import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Assumendo che auth sia configurato correttamente
import prisma from '@/lib/prisma'; // La tua istanza Prisma centralizzata

export async function PUT(
  req: NextRequest,
  context: { params: { conversationId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const conversationId = context.params.conversationId;
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
    // Verifica che la conversazione appartenga all'utente
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversazione non trovata' }, { status: 404 });
    }

    if (conversation.userId !== session.user.id) {
      return NextResponse.json({ error: 'Non autorizzato a modificare questa conversazione' }, { status: 403 });
    }

    // Aggiorna il titolo
    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: newTitle.trim() },
    });

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error('Errore durante l\'aggiornamento del titolo della conversazione:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
