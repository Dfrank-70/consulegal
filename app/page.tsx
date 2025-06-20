import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageSquare, ShieldCheck, Scale } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="py-6 px-4 md:px-8 bg-background border-b">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">ConsulLegal AI</h1>
          <div className="space-x-4">
            <Link href="/login">
              <Button variant="outline" size="sm">Accedi</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Registrati</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-background to-muted">
          <div className="container mx-auto text-center px-4">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Consulenza Legale Potenziata dall'AI</h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Ottieni risposte rapide e accurate alle tue domande legali grazie all'intelligenza artificiale avanzata.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="px-8">
                  Inizia Ora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              {/* <Link href="/pricing">
                <Button variant="outline" size="lg" className="px-8">
                  Scopri i Piani
                </Button>
              </Link> */}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">I Vantaggi della Consulenza Legale AI</h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <div className="p-4 bg-primary/10 rounded-full w-fit mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Risposte Immediate</h3>
                <p className="text-muted-foreground">
                  Ottieni consulenza istantanea 24/7, senza attese o appuntamenti.
                </p>
              </div>
              
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <div className="p-4 bg-primary/10 rounded-full w-fit mb-4">
                  <Scale className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Expertise Legale</h3>
                <p className="text-muted-foreground">
                  Basato su vasta conoscenza giuridica italiana e best practices legali.
                </p>
              </div>
              
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <div className="p-4 bg-primary/10 rounded-full w-fit mb-4">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Sicurezza Garantita</h3>
                <p className="text-muted-foreground">
                  Massima protezione dei dati e conformità GDPR per tutte le tue informazioni.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container mx-auto text-center px-4">
            <h2 className="text-3xl font-bold mb-4">Pronto a Trasformare la tua Consulenza Legale?</h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Iscriviti oggi e ottieni accesso immediato alla piattaforma di consulenza legale AI.
            </p>
            <Link href="/register">
              <Button variant="secondary" size="lg">
                Registrati Gratuitamente
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-muted py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-3">ConsulLegal AI</h3>
              <p className="text-muted-foreground">Consulenza legale intelligente, disponibile 24/7.</p>
            </div>
            <div>
              <h4 className="font-medium mb-3">Servizi</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:underline">Consulenza Legale AI</Link></li>
                <li><Link href="#" className="hover:underline">Revisione Documenti</Link></li>
                <li><Link href="#" className="hover:underline">Risposte Legali</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Azienda</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:underline">Chi Siamo</Link></li>
                <li><Link href="#" className="hover:underline">Contatti</Link></li>
                <li><Link href="#" className="hover:underline">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Legale</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:underline">Privacy Policy</Link></li>
                <li><Link href="#" className="hover:underline">Termini di Servizio</Link></li>
                <li><Link href="#" className="hover:underline">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} ConsulLegal AI. Tutti i diritti riservati.</p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              {/* Social media icons would go here */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
