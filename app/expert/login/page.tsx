"use client";

import { ExpertLoginForm } from "@/components/auth/expert-login-form";

export default function ExpertLoginPage() {
  return (
    <div className="container flex h-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Piattaforma Traspolegal
          </h1>
          <h2 className="text-lg font-medium text-muted-foreground">
            Accesso consulenti
          </h2>
          <p className="text-sm text-muted-foreground">
            Accesso e registrazione riservati esclusivamente ai consulenti legali.
          </p>
        </div>
        <ExpertLoginForm />
      </div>
    </div>
  );
}
