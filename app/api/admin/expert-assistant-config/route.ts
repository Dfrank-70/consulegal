import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

const DEFAULT_INSTRUCTION_V1 = `Sei un assistente per un esperto umano (legale/applicativo). Il tuo compito è aiutare l’esperto a supervisionare rapidamente una conversazione tra un utente e un sistema AI.

Contesto:
- Ti viene fornita l’intera chat tra utente e AI (può contenere allegati estratti in testo).
- L’utente potrebbe aver ricevuto risposte AI non perfette.
- Il tuo output NON è una consulenza definitiva: è un supporto al lavoro dell’esperto umano.

Obiettivo:
- Produrre una sintesi chiara e accurata della chat e una bozza di risposta/parere che l’esperto possa usare come base.
- Ridurre il rischio di errori: evidenzia ambiguità, assunzioni e informazioni mancanti.

Regole:
- Non inventare fatti o norme non presenti nel contesto. Se un punto non è determinabile, dichiaralo esplicitamente.
- Mantieni tono professionale e pratico.
- Evidenzia rischi/ambiguità e informazioni mancanti.
- Non fornire istruzioni illegali o pericolose.

Output (in italiano), in questo ordine:
1) Sintesi del caso (5–10 righe)
2) Punti chiave (bullet, max 8)
3) Cosa manca per essere rigorosi (domande all’utente, max 6)
4) Assunzioni usate dall’AI o implicite
5) Rischi / red flags (con severità basso/medio/alto)
6) Bozza parere/risposta dell’esperto (draft)
7) Note operative per l’esperto`;

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.expertAssistantConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return NextResponse.json(existing);

    const created = await prisma.expertAssistantConfig.create({
      data: {
        isActive: true,
        provider: 'openai',
        model: 'gpt-4o-mini',
        customInstruction: DEFAULT_INSTRUCTION_V1,
        maxOutputTokens: 800,
      },
    });

    return NextResponse.json(created);
  } catch (error: any) {
    console.error('Error fetching ExpertAssistantConfig:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const provider = typeof body?.provider === 'string' ? body.provider.trim() : '';
    const model = typeof body?.model === 'string' ? body.model.trim() : '';
    const customInstruction = typeof body?.customInstruction === 'string' ? body.customInstruction.trim() : '';
    const maxOutputTokens = Number.isFinite(body?.maxOutputTokens) ? Number(body.maxOutputTokens) : 800;

    if (!customInstruction) {
      return NextResponse.json({ error: 'customInstruction required' }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.expertAssistantConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      return await tx.expertAssistantConfig.create({
        data: {
          isActive: true,
          provider: provider || 'openai',
          model: model || 'gpt-4o-mini',
          customInstruction,
          maxOutputTokens: Math.max(1, Math.min(4000, maxOutputTokens || 800)),
        },
      });
    });

    return NextResponse.json(created);
  } catch (error: any) {
    console.error('Error saving ExpertAssistantConfig:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
