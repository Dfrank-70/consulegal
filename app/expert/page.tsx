import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ExpertAreaPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-2xl text-center space-y-6">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-primary">
            Area riservata ai consulenti legali
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold">
              Area consulenti esperti
            </h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Accedi o candidati come consulente legale. Questa sezione è dedicata
              esclusivamente ai professionisti.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={"/expert/login" as "/expert/login"}>
              <Button size="lg" className="px-8">
                Accedi come consulente
              </Button>
            </Link>
            <Link href="/expert/apply">
              <Button variant="outline" size="lg" className="px-8">
                Candidati come consulente
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Registrazione e accesso soggetti ad approvazione.
          </p>
          <div className="text-sm text-muted-foreground">
            Sei un cliente? Vai alla <Link href="/login" className="underline">login clienti</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
