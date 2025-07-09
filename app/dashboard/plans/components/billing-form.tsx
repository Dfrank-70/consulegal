"use client";

import { useState } from 'react';
import { Plan, Subscription } from '@prisma/client';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

interface BillingFormProps {
  subscription: Subscription | null;
  plans: Plan[];
  userId: string;
}

export function BillingForm({ subscription, plans, userId }: BillingFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscription = async (priceId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }), // userId is obtained from the session on the server
      });

      if (!response.ok) {
        // We try to parse the error response to get a more specific message.
        const errorData = await response.json().catch(() => ({ error: 'Server returned an error, but failed to parse the response body.' }));
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const session = await response.json();
      window.location.href = session.url;
    } catch (error) { 
      const errorMessage = error instanceof Error ? error.message : 'Si è verificato un errore sconosciuto.';
      console.error("Subscription error:", errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>I nostri piani</CardTitle>
        <CardDescription>
          Scegli il piano più adatto alle tue esigenze.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={subscription?.stripePriceId === plan.stripePriceId ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col justify-between h-full">
              <div>
                <p className="text-3xl font-bold mb-4">€{Number(plan.price).toFixed(2).replace('.', ',')}<span className="text-sm font-normal">/mese</span></p>
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Button 
                className="mt-6 w-full"
                disabled={isLoading}
                onClick={() => handleSubscription(plan.stripePriceId)}
              >
                {subscription?.stripePriceId === plan.stripePriceId ? 'Piano Attuale' : 'Scegli Piano'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
