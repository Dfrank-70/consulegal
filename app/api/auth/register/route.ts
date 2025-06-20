import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e password sono richiesti" },
        { status: 400 }
      );
    }

    // Verifica se l'utente è già registrato
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email già registrata" },
        { status: 400 }
      );
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crea nuovo utente
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "CLIENT", // Default role
      },
    });

    // Rimuovi la password dalla risposta
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      {
        user: userWithoutPassword,
        message: "Registrazione completata con successo",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Errore durante la registrazione:", error);
    return NextResponse.json(
      { error: "Si è verificato un errore durante la registrazione" },
      { status: 500 }
    );
  }
}
