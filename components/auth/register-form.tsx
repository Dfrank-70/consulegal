"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState("PRIVATE");
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [sdiCode, setSdiCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Le password non corrispondono");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const priceId = searchParams?.get('priceId');

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          userType,
          companyName: userType === 'COMPANY' ? companyName : undefined,
          vatNumber: userType === 'COMPANY' ? vatNumber : undefined,
          billingAddress: userType === 'COMPANY' ? billingAddress : undefined,
          sdiCode: userType === 'COMPANY' ? sdiCode : undefined,
          priceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Si è verificato un errore durante la registrazione");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push("/login?registered=true");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Registrazione</CardTitle>
        <CardDescription>
          Crea un nuovo account per accedere alla consulenza legale AI
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
            <Label htmlFor="name">Nome e Cognome</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mario Rossi"
              required
            />
          </div>

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
            <Label>Tipo di account</Label>
            <RadioGroup
              defaultValue="PRIVATE"
              onValueChange={(value: string) => setUserType(value)}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PRIVATE" id="r1" />
                <Label htmlFor="r1">Privato</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="COMPANY" id="r2" />
                <Label htmlFor="r2">Azienda</Label>
              </div>
            </RadioGroup>
          </div>

          {userType === 'COMPANY' && (
            <div className="space-y-4 p-4 border rounded-md bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome Azienda</Label>
                <Input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Azienda S.r.l."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">Partita IVA</Label>
                <Input
                  id="vatNumber"
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="IT12345678901"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingAddress">Indirizzo di Fatturazione</Label>
                <Input
                  id="billingAddress"
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Via Roma, 1, 00100 Roma RM"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sdiCode">Codice Destinatario (SDI)</Label>
                <Input
                  id="sdiCode"
                  type="text"
                  value={sdiCode}
                  onChange={(e) => setSdiCode(e.target.value)}
                  placeholder="0000000 o indirizzo PEC"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Conferma Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Registrazione in corso..." : "Registrati"}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          Hai già un account?{" "}
          <a href="/login" className="text-blue-600 hover:underline">
            Accedi
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
