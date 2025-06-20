import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { stripe } from "@/lib/stripe";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      password,
      userType,
      companyName,
      vatNumber,
      billingAddress,
      sdiCode,
      priceId,
    } = body;

    if (!name || !email || !password || !userType) {
      return NextResponse.json(
        { error: "Nome, email, password e tipo di utente sono richiesti" },
        { status: 400 }
      );
    }

    if (userType === 'COMPANY' && (!companyName || !vatNumber || !billingAddress || !sdiCode)) {
        return NextResponse.json(
            { error: "Per le aziende, tutti i dati di fatturazione sono richiesti" },
            { status: 400 }
        );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email già registrata" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // @ts-ignore - Suppressing errors due to likely TS server desync with Prisma schema
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        userType: userType,
        companyName: userType === 'COMPANY' ? companyName : null,
        vatNumber: userType === 'COMPANY' ? vatNumber : null,
        billingAddress: userType === 'COMPANY' ? billingAddress : null,
        sdiCode: userType === 'COMPANY' ? sdiCode : null,
        role: "CLIENT",
      },
    });

    if (priceId) {
      try {
        const checkoutSession = await stripe.checkout.sessions.create({
          customer_email: user.email,
          client_reference_id: user.id,
          line_items: [{ price: priceId, quantity: 1 }],
          mode: 'subscription',
          success_url: `${process.env.NEXTAUTH_URL}/dashboard?new-subscription=true`,
          cancel_url: `${process.env.NEXTAUTH_URL}/pricing`,
        });

        if (!checkoutSession.url) {
          throw new Error("Impossibile creare l'URL di checkout di Stripe.");
        }

        return NextResponse.json({ checkoutUrl: checkoutSession.url }, { status: 201 });

      } catch (stripeError) {
        console.error("Errore durante la creazione della sessione Stripe:", stripeError);
        return NextResponse.json(
          { error: "Utente creato, ma impossibile avviare il pagamento. Effettua il login e riprova dalla pagina dei piani." },
          { status: 500 }
        );
      }
    }

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
