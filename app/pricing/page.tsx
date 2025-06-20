"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from 'lucide-react'; // Icona per le feature

// !!! IMPORTANTE: Sostituisci questi PRICE_ID con i tuoi ID di prezzo reali da Stripe !!!
// Ad esempio: price_1PAbcdEFGHijklmnopqRSTuv
const plans = [
  {
    name: "ConsulLight",
    priceId: "price_1Rc3KZIe4PsbLJO4f9Ol0Cvs", 
    price: "€9.99",
    frequency: "/mese",
    description: "Ideale per iniziare e per esigenze di base.",
    features: [
      "Accesso limitato al Chatbot AI (es. 50 messaggi/mese)",
      "Cronologia chat base (ultimi 7 giorni)",
      "Supporto via email",
    ],
    cta: "Scegli Light",
  },
  {
    name: "ConsulPro",
    priceId: "price_1Rc3LFIe4PsbLJO4nLFy2p3i", 
    price: "€29.99",
    frequency: "/mese",
    description: "Perfetto per professionisti e utenti regolari.",
    features: [
      "Accesso standard al Chatbot AI (es. 200 messaggi/mese)",
      "Modelli AI standard",
      "Cronologia chat estesa (ultimi 30 giorni)",
      "Analisi documenti base (fino a 5 doc/mese)",
      "Supporto prioritario via email",
    ],
    cta: "Scegli Pro",
    popular: true,
  },
  {
    name: "ConsulExpert",
    priceId: "price_1Rc3LpIe4PsbLJO4ETiGG41d", 
    price: "€79.99",
    frequency: "/mese",
    description: "La soluzione completa per studi legali e aziende.",
    features: [
      "Accesso illimitato al Chatbot AI",
      "Accesso a modelli AI avanzati",
      "Cronologia chat completa",
      "Analisi documenti avanzata (fino a 20 doc/mese, OCR)",
      "Supporto dedicato via chat e telefono",
      "Accesso API (opzionale)",
    ],
    cta: "Scegli Expert",
  },
];

export default function PricingPage() {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleSubscribe = async (priceId: string) => {
    if (status === 'loading') return; // Non fare nulla mentre si controlla la sessione

    if (status === 'unauthenticated') {
      router.push(`/register?priceId=${priceId}`);
      return;
    }
    if (!priceId || priceId.startsWith("PRICE_ID_")) {
      alert("ID del piano non configurato correttamente. Assicurati di aver inserito i Price ID di Stripe validi.");
      console.error("Stripe Price ID is a placeholder or missing:", priceId);
      return;
    }
    setLoadingPriceId(priceId);
    try {
      const response = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      const sessionData = await response.json(); // Rinominato per chiarezza

      if (response.ok && sessionData.url) {
        window.location.href = sessionData.url;
      } else {
        console.error('Failed to create Stripe session:', sessionData.error);
        alert(`Errore: ${sessionData.error || 'Impossibile creare la sessione di pagamento.'}`);
      }
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Si è verificato un errore durante la sottoscrizione.');
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Piani Tariffari Flessibili
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Scegli il piano più adatto alle tue esigenze di consulenza legale AI.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={`flex flex-col ${plan.popular ? 'border-primary shadow-lg' : ''}`}>
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-semibold">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="mb-6">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.frequency}</span>
              </div>
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className={`w-full ${plan.popular ? '' : 'variant-outline'}`}
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={loadingPriceId === plan.priceId || !plan.priceId || plan.priceId.startsWith("PRICE_ID_")}
              >
                {loadingPriceId === plan.priceId ? 'Caricamento...' : plan.cta}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-muted-foreground">
          Hai bisogno di un piano personalizzato? <a href="/contact" className="text-primary hover:underline">Contattaci</a>.
        </p>
      </div>
    </div>
  );
}
