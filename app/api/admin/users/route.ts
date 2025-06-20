import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth"; // Usando l'alias @ per la root del progetto


export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // Verifica il ruolo dell'utente
    // Assumiamo che il ruolo sia memorizzato in session.user.role
    // e che UserRole.ADMIN sia il valore per gli amministratori
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accesso negato. Riservato agli amministratori." },
        { status: 403 } // Forbidden
      );
    }

    // Recupera tutti gli utenti con i dettagli dell'abbonamento
    const users = await prisma.user.findMany({
      select: {
        id: true,

        email: true,

        role: true,
        isBlocked: true,
        createdAt: true,
        updatedAt: true,
        customInstructions: true,
        subscription: {
          select: {
            id: true,
            plan: true,
            status: true,
            tokenLimit: true,
            createdAt: true,
          },
        },
        _count: {
          select: { conversations: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      }
    });

    return NextResponse.json(users);

  } catch (error: any) {
    console.error("Errore nell'API GET /api/admin/users:", error);
    return NextResponse.json(
      { 
        error: "Si è verificato un errore durante il recupero degli utenti.",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
