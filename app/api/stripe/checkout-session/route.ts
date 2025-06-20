import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/auth"; 
import { stripe } from '@/lib/stripe';
import prisma from '@/lib/prisma'; // Importa l'istanza condivisa
import type { User as PrismaUser, Prisma } from '@prisma/client'; // Importa User come PrismaUser e Prisma namespace

export async function POST(req: NextRequest) {
  try {
    const session = await auth(); // Utilizza la funzione auth() per ottenere la sessione

    if (!session || !session.user || !session.user.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized: User not logged in, or user ID/email missing' }, { status: 401 });
    }

    const userId = session.user.id; // Assumendo che la sessione NextAuth includa user.id
    const userEmail = session.user.email;

    const body = await req.json();
    const { priceId } = body;

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // 1. Trova l'utente nel database
    const userFromDb: PrismaUser | null = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!userFromDb) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // La variabile userFromDb è già tipizzata come PrismaUser | null.
    // Dopo il controllo !userFromDb, TypeScript dovrebbe inferire PrismaUser.
    // Per maggiore robustezza contro problemi di inferenza, creiamo una nuova var.
    const confirmedUser: PrismaUser = userFromDb;

    // 2. Controlla se l'utente ha già uno stripeCustomerId
    let currentStripeCustomerId = confirmedUser.stripeCustomerId;

    if (!currentStripeCustomerId) {
      // 3. Se non ce l'ha, crea un nuovo cliente Stripe
      const customer = await stripe.customers.create({
        email: session.user.email!, // Aggiunta ! per asserire che email esiste, dato che è controllato prima
        name: session.user.name || undefined,
      });
      const newStripeCustomerId = customer.id;

      // 4. Prepara i dati per l'aggiornamento con tipo esplicito
      const updateData: Prisma.UserUpdateInput = {
        stripeCustomerId: newStripeCustomerId,
      };

      // Salva il nuovo stripeCustomerId nel tuo database
      await prisma.user.update({
        where: { id: confirmedUser.id },
        data: updateData,
      });
      currentStripeCustomerId = newStripeCustomerId; // Aggiorna la variabile locale
    }

    // Assicurati che currentStripeCustomerId sia definito prima di procedere
    if (!currentStripeCustomerId) {
      return NextResponse.json({ error: 'Stripe customer ID could not be established.' }, { status: 500 });
    }

    // 5. Crea la sessione di checkout Stripe
    const stripeSession = await stripe.checkout.sessions.create({
      customer: currentStripeCustomerId, // Usa la variabile aggiornata
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard?new-subscription=true`,
      cancel_url: `${appUrl}/pricing`,
      client_reference_id: userId,
      // metadata: { 
      //   userId: user.id,
      // },
    });

    if (!stripeSession.url) {
        return NextResponse.json({ error: 'Could not create Stripe session' }, { status: 500 });
    }

    // 6. Restituisci l'URL della sessione di checkout
    return NextResponse.json({ sessionId: stripeSession.id, url: stripeSession.url });

  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}
