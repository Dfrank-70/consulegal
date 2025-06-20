import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createStripePortal } from "./actions";
import { subscriptionPlans } from "@/config/subscriptions";

const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex justify-between py-2 border-b last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right">{value || 'Non specificato'}</span>
  </div>
);

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    // Potrebbe accadere se l'utente viene eliminato ma la sessione è ancora valida
    redirect("/login");
  }

  const subscription = await prisma.subscription.findUnique({
    where: {
      userId: user.id,
    },
  });

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Profilo Utente</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>I Tuoi Dati</CardTitle>
            <CardDescription>Informazioni di base e di fatturazione del tuo account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <DetailRow label="Nome" value={user.name} />
            <DetailRow label="Email" value={user.email} />
            <DetailRow label="Tipo Utente" value={user.userType} />
            <DetailRow label="Registrato il" value={new Date(user.createdAt).toLocaleDateString('it-IT')} />

            {user.userType === 'COMPANY' && (
              <>
                <h3 className="text-lg font-semibold pt-6 pb-2">Dati Aziendali</h3>
                <DetailRow label="Ragione Sociale" value={user.companyName} />
                <DetailRow label="Partita IVA" value={user.vatNumber} />
                <DetailRow label="Indirizzo Fatturazione" value={user.billingAddress} />
                <DetailRow label="Codice SDI" value={user.sdiCode} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gestione Abbonamento</CardTitle>
            <CardDescription>Visualizza e gestisci il tuo piano.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {
              subscription && subscription.status === 'active' ? (
                <>
                                    <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Stato</span>
                    <span className="font-semibold text-green-600">Attivo</span>
                  </div>
                  {subscription.stripePriceId && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Piano</span>
                      <span className="font-semibold">
                        {subscriptionPlans[subscription.stripePriceId as keyof typeof subscriptionPlans]?.name || 'Sconosciuto'}
                      </span>
                    </div>
                  )}
                  {subscription.currentPeriodEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Prossimo rinnovo</span>
                      <span className="font-semibold">
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString('it-IT')}
                      </span>
                    </div>
                  )}
                  <form action={createStripePortal}>
                    <Button className="w-full">Gestisci Abbonamento su Stripe</Button>
                  </form>
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p>Nessun abbonamento attivo.</p>
                </div>
              )
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
