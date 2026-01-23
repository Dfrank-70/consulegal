"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ExpertLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Credenziali non valide. Riprova.");
        return;
      }

      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json().catch(() => null);
      const role = session?.user?.role as string | undefined;

      if (role !== "EXPERT" && role !== "EXPERT_PENDING") {
        await signOut({ redirect: false });
        setError("Accesso riservato ai consulenti esperti.");
        return;
      }

      window.location.href = role === "EXPERT" ? "/dashboard/expert" : "/expert/status";
    } catch (err) {
      console.error("Expert login error:", err);
      setError("Si è verificato un errore durante il login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Accedi come consulente</CardTitle>
        <CardDescription>
          Area di accesso riservata ai consulenti legali.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@esempio.it"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a href="/reset-password" className="text-sm text-blue-600 hover:underline">
                Password dimenticata?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Accesso in corso..." : "Accedi"}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Area di accesso riservata ai consulenti.
        </div>
      </CardContent>
    </Card>
  );
}
