"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import { Plan } from "@prisma/client";

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const fetchPlans = async () => {
      setIsLoading(true);
      try {
                const response = await axios.get<Plan[]>('/api/plans');
        const activePlans = response.data.filter(plan => plan.isActive);
        setPlans(activePlans);
      } catch (error) {
        toast.error("Impossibile caricare i piani di abbonamento.");
        console.error('Failed to fetch plans:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleSubscribe = async (priceId: string) => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setLoadingPriceId(priceId);
    try {
      const { data } = await axios.post('/api/stripe/checkout-session', {
        priceId,
      });
      router.push(data.url);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        toast.error("Sessione scaduta. Effettua di nuovo il login per continuare.");
        router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      } else {
        toast.error("Si è verificato un errore. Riprova più tardi.");
        console.error("Subscription error:", error);
      }
    } finally {
      setLoadingPriceId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-lg">Caricamento dei piani...</p>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Piani Tariffari Flessibili
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
            Scegli il piano più adatto alle tue esigenze e inizia subito a sfruttare la potenza di ConsulLegal AI.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={`flex flex-col border-2 ${plan.name === 'Medium' ? 'border-primary' : 'border-border'}`}>
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="mb-6">
                  <span className="text-5xl font-extrabold">€{plan.price}</span>
                  <span className="text-lg font-medium text-muted-foreground">/mese</span>
                </div>
                <ul className="space-y-4">
                                                      {plan.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="h-6 w-6 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature.trim()}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(plan.stripePriceId)}
                  disabled={loadingPriceId === plan.stripePriceId || status === 'loading'}
                  variant={plan.name === 'Medium' ? 'default' : 'outline'}
                >
                  {loadingPriceId === plan.stripePriceId ? 'Reindirizzamento...' : `Scegli ${plan.name}`}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
      <div className="mt-16 text-center">
        <p className="text-muted-foreground">
          Hai bisogno di un piano personalizzato? <a href="/contact" className="text-primary hover:underline">Contattaci</a>.
        </p>
      </div>
    </div>
  );
}
