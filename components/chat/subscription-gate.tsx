import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket } from 'lucide-react';

export function SubscriptionGate() {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4 text-2xl">Attiva il tuo piano</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Per sbloccare la chat e iniziare a interagire con il nostro assistente legale AI, è necessario un abbonamento attivo.
          </p>
          <Button asChild className="w-full">
            <Link href="/pricing">Vedi i Piani</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
