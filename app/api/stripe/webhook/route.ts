// app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";

import Stripe from "stripe";
import { stripe } from "@/lib/stripe"; // La tua istanza Stripe configurata
import prisma from "@/lib/prisma"; // La tua istanza Prisma configurata
import { Prisma } from "@prisma/client";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  console.error(
    "STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification will fail.",
  );
  // In un ambiente di produzione, potresti voler lanciare un errore o gestire diversamente
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") as string;

  if (!webhookSecret) {
    console.error("Webhook secret not configured. Cannot verify signature.");
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 500 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Error message: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 },
    );
  }

  // Log dell'evento ricevuto per debug
  console.log("Stripe webhook event received:", event.type, event.id);

  // Gestisci i tipi di evento specifici
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(
        "Full Stripe Session object in checkout.session.completed:",
        JSON.stringify(session, null, 2),
      );
      console.log("Checkout session completed:", session.id);
      // Logica per gestire una sessione di checkout completata
      // Esempio: recuperare i dettagli dell'abbonamento e del cliente,
      // salvare/aggiornare il record di abbonamento nel tuo DB.
      // Assicurati che session.customer e session.subscription siano stringhe o oggetti Stripe.Customer/Stripe.Subscription

      const customerId = session.customer;
      const subscriptionId = session.subscription;
      const clientReferenceId = session.client_reference_id;

      console.log(
        "Attempting to create subscription for clientReferenceId:",
        clientReferenceId,
      ); // NUOVO LOG

      if (!clientReferenceId) {
        console.error(
          "CRITICAL: client_reference_id is missing in checkout.session.completed event. Cannot create subscription.",
        );
        return NextResponse.json(
          { error: "Client reference ID is missing." },
          { status: 400 },
        );
      } // Dovrebbe essere il tuo user.id

      if (!clientReferenceId) {
        console.error(
          "Checkout session completed without client_reference_id (userId). Cannot process.",
        );
        return NextResponse.json(
          { error: "Missing client_reference_id" },
          { status: 400 },
        );
      }

      if (typeof subscriptionId !== "string") {
        console.error("Subscription ID is not a string:", subscriptionId);
        return NextResponse.json(
          { error: "Invalid subscription ID type" },
          { status: 400 },
        );
      }

      // Recupera i dettagli completi dell'abbonamento da Stripe
      const subscription: Stripe.Subscription =
        await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["default_payment_method", "plan.product"],
        });
      console.log(
        "Full Stripe Subscription object from RETRIEVE:",
        JSON.stringify(subscription, null, 2),
      ); // NUOVO LOG

      if (!subscription) {
        console.error(
          "Could not retrieve subscription details from Stripe:",
          subscriptionId,
        );
        return NextResponse.json(
          { error: "Failed to retrieve subscription" },
          { status: 500 },
        );
      }

      const firstItem = subscription.items.data[0];
      let stripeProductId: string | undefined;
      let stripePriceId: string | undefined;

      if ("plan" in subscription && subscription.plan) {
        const currentPlan = subscription.plan as Stripe.Plan; // Assert type to Stripe.Plan

        if (
          currentPlan.product &&
          typeof currentPlan.product === "object" &&
          "id" in currentPlan.product
        ) {
          // currentPlan.product is an expanded Stripe.Product object
          stripeProductId = (currentPlan.product as Stripe.Product).id;
        } else if (typeof currentPlan.product === "string") {
          // currentPlan.product is a string ID (fallback)
          stripeProductId = currentPlan.product;
        }
      } else {
        console.error(
          'CRITICAL: Property "plan" is missing or null on the subscription object from Stripe retrieve.',
          subscriptionId,
          {
            subscriptionKeys: Object.keys(subscription).join(", "),
            hasPlanProperty: "plan" in subscription,
            planValue:
              "plan" in subscription
                ? subscription.plan
                : "plan property not found",
          },
        );
        return NextResponse.json(
          {
            error: "Subscription object structure error (missing plan details)",
          },
          { status: 500 },
        );
      }

      if (
        firstItem &&
        firstItem.price &&
        typeof firstItem.price.id === "string"
      ) {
        stripePriceId = firstItem.price.id;
      }

      if (!stripeProductId || !stripePriceId) {
        console.error(
          `Price or product details missing in subscription: ${subscription.id}. Debug details: `,
          {
            subscriptionId: subscription.id,
            checkoutSessionId: session.id,
            clientReferenceId: clientReferenceId,
            retrievedSubscriptionObject: subscription, // Log the object directly for better inspection in Node console
            planObjectFromSubscription: subscription.plan,
            firstSubscriptionItem: firstItem,
            extractedStripeProductId: stripeProductId, // Log the value that was actually extracted
            extractedStripePriceId: stripePriceId, // Log the value that was actually extracted
          },
        );
        return NextResponse.json(
          { error: "Failed to extract essential product/price IDs" },
          { status: 500 },
        );
      }
      // stripeProductId e stripePriceId sono ora usati sotto

      // NUOVO: Verifica se l'utente esiste prima di creare la sottoscrizione
      const userExists = await prisma.user.findUnique({
        where: { id: clientReferenceId },
      });

      if (!userExists) {
        console.error(
          `CRITICAL: User with ID ${clientReferenceId} NOT FOUND in database before attempting to create subscription.`,
        );
        return NextResponse.json(
          { error: `User with ID ${clientReferenceId} not found.` },
          { status: 404 },
        ); // Errore specifico
      }
      console.log(
        `User ${clientReferenceId} confirmed to exist in DB before subscription creation.`,
      ); // NUOVO LOG

      const commonSubscriptionData = {
        stripeSubscriptionId: subscription.id, // from Stripe checkout session's subscription object
        stripePriceId: subscription.items.data[0]?.price.id, // from Stripe checkout session's subscription object
        stripeProductId: stripeProductId, // This variable is correctly defined from the expanded plan product
        status: subscription.status,
        // @ts-ignore - Stripe.Subscription should have these, but TS struggles here
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        // @ts-ignore - Stripe.Subscription should have these, but TS struggles here
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialStart: subscription.trial_start
          ? new Date(subscription.trial_start * 1000)
          : null,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      };

      try {
        if (!session.customer) {
          throw new Error("Customer ID missing from checkout session.");
        }

        // Use a transaction to update the user and create the subscription together
        const userUpdatePromise = prisma.user.update({
          where: { id: clientReferenceId },
          data: { stripeCustomerId: session.customer as string },
        });

        const subscriptionUpsertPromise = prisma.subscription.upsert({
          where: { userId: clientReferenceId },
          update: {
            ...commonSubscriptionData,
          },
          create: {
            userId: clientReferenceId,
            ...commonSubscriptionData,
          },
        });

        await prisma.$transaction([
          userUpdatePromise,
          subscriptionUpsertPromise,
        ]);

        console.log(
          `User ${clientReferenceId} updated with Stripe customer ID and subscription ${subscription.id} upserted.`,
        );
      } catch (dbError: any) {
        console.error(
          `Error upserting subscription in DB for user ${clientReferenceId}:`,
          dbError,
        );
        if (dbError instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(`Prisma Error Code: ${dbError.code}`);
          console.error(`Prisma Error Meta: ${JSON.stringify(dbError.meta)}`);
        }
        return NextResponse.json(
          { error: "Failed to upsert subscription in DB" },
          { status: 500 },
        );
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      console.log("Invoice payment succeeded:", invoice.id);
      // Se l'abbonamento è creato tramite checkout.session.completed,  questo evento potrebbe essere ridondante
      // o usato per aggiornare lo stato se necessario. Per ora, ci concentriamo su checkout.session.completed per la creazione.
      // Potrebbe essere utile per gestire rinnovi.
      // @ts-ignore - Windsurf/TS ha problemi con invoice.subscription da stripe@18.x.x
      if (invoice.subscription && typeof invoice.subscription === "string") {
        // @ts-ignore - Windsurf/TS ha problemi con invoice.subscription da stripe@18.x.x
        const subscriptionId = invoice.subscription;
        const subscriptionDetails: Stripe.Subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        try {
          const subWhereClause: Prisma.SubscriptionWhereUniqueInput = {
            stripeSubscriptionId: subscriptionId,
          };
          const subUpdateData: Prisma.SubscriptionUpdateInput = {
            status: subscriptionDetails.status,
            // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
            currentPeriodStart: new Date(
              subscriptionDetails.current_period_start * 1000,
            ),
            // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
            currentPeriodEnd: new Date(
              subscriptionDetails.current_period_end * 1000,
            ),
            cancelAtPeriodEnd: subscriptionDetails.cancel_at_period_end,
            // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
            canceledAt: subscriptionDetails.canceled_at
              ? new Date(subscriptionDetails.canceled_at * 1000)
              : null,
            // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
            endedAt: subscriptionDetails.ended_at
              ? new Date(subscriptionDetails.ended_at * 1000)
              : null,
          };
          const userUpdateData: Prisma.UserUpdateInput = {
            stripeCustomerId: subscriptionDetails.customer as string,
          };
          const userWhereClause: Prisma.UserWhereUniqueInput = {
            stripeCustomerId: subscriptionDetails.customer as string,
          };
          await prisma.user.update({
            where: userWhereClause,
            data: userUpdateData,
          });
          await prisma.subscription.update({
            where: subWhereClause,
            data: subUpdateData,
          });
          console.log(
            `Subscription ${subscriptionId} updated on invoice.payment_succeeded.`,
          );
        } catch (dbError: any) {
          console.error(
            `Error updating subscription ${subscriptionId} on invoice.payment_succeeded:`,
            dbError,
          );
          // Gestisci il caso in cui l'abbonamento non sia trovato (improbabile se invoice.subscription è presente)
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": // Gestisce cancellazioni immediate o alla fine del periodo
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(
        `Subscription event: ${event.type}`,
        subscription.id,
        subscription.status,
      );
      try {
        const whereClause: Prisma.SubscriptionWhereUniqueInput = {
          stripeSubscriptionId: subscription.id,
        };
        const updateData: Prisma.SubscriptionUpdateInput = {
          status: subscription.status,
          stripePriceId: subscription.items.data[0]?.price.id, // Aggiorna il priceId se cambia piano
          // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
          currentPeriodStart: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000)
            : null,
          // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
          canceledAt: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : null,
          // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
          endedAt: subscription.ended_at
            ? new Date(subscription.ended_at * 1000)
            : null,
          // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
          trialStart: subscription.trial_start
            ? new Date(subscription.trial_start * 1000)
            : null,
          // @ts-ignore - Windsurf/TS ha problemi con questi campi da stripe@18.x.x
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
        };

        await prisma.subscription.update({
          where: whereClause,
          data: updateData,
        });
        console.log(
          `Subscription ${subscription.id} updated to status ${subscription.status}.`,
        );
      } catch (dbError: any) {
        console.error(
          `Error updating subscription ${subscription.id} for event ${event.type}:`,
          dbError,
        );
        // Potrebbe essere che l'abbonamento non esista ancora nel DB se il webhook arriva prima di checkout.session.completed
        // o se è un abbonamento non gestito. Per ora, logghiamo.
      }
      break;
    }

    // Aggiungi altri casi per eventi che ti interessano
    // es. invoice.payment_failed, customer.subscription.deleted, etc.

    default:
      console.warn(`Unhandled event type: ${event.type}`);
  }

  // Restituisci una risposta 200 per confermare la ricezione dell'evento a Stripe
  return NextResponse.json({ received: true }, { status: 200 });
}

// Nota: Per testare i webhook localmente, puoi usare la Stripe CLI:
// 1. Installa la Stripe CLI: https://stripe.com/docs/stripe-cli
// 2. Accedi: stripe login
// 3. Inoltra gli eventi al tuo endpoint locale:
//    stripe listen --forward-to localhost:3000/api/stripe/webhook
//    (assicurati che la porta 3000 sia quella su cui gira la tua app Next.js)
//    La CLI ti fornirà un webhook signing secret (es. whsec_...) da usare per STRIPE_WEBHOOK_SECRET nel tuo .env
