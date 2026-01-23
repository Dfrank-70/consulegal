"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRACTICE_AREAS = [
  "Trasporto",
  "Contratti",
  "Privacy",
  "Societario",
  "Lavoro",
  "Famiglia",
];

export default function ExpertApplyPage() {
  const router = useRouter();
  const [formState, setFormState] = useState({
    fullName: "",
    email: "",
    password: "",
    firmName: "",
    phone: "",
    practiceAreas: [] as string[],
    consent: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleArea = (area: string) => {
    setFormState((prev) => {
      const exists = prev.practiceAreas.includes(area);
      return {
        ...prev,
        practiceAreas: exists
          ? prev.practiceAreas.filter((item) => item !== area)
          : [...prev.practiceAreas, area],
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/expert/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Errore durante la richiesta");
      }

      setSuccess(true);
      setTimeout(() => router.push("/expert/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-xl bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Richiedi accesso come esperto</h1>
          <p className="text-slate-300">Compila i tuoi dati. La richiesta sarà valutata dal team.</p>
        </div>

        {error && <div className="bg-red-900/40 text-red-200 p-3 rounded">{error}</div>}
        {success && <div className="bg-green-900/40 text-green-200 p-3 rounded">Richiesta inviata. Ti reindirizziamo al login.</div>}

        <div>
          <label className="block text-sm mb-1">Nome e Cognome *</label>
          <input
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
            value={formState.fullName}
            onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Email *</label>
            <input
              type="email"
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
              value={formState.email}
              onChange={(e) => setFormState({ ...formState, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password *</label>
            <input
              type="password"
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
              value={formState.password}
              onChange={(e) => setFormState({ ...formState, password: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Studio (opzionale)</label>
            <input
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
              value={formState.firmName}
              onChange={(e) => setFormState({ ...formState, firmName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Telefono (opzionale)</label>
            <input
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2"
              value={formState.phone}
              onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <p className="text-sm mb-2">Aree di pratica</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PRACTICE_AREAS.map((area) => (
              <label key={area} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formState.practiceAreas.includes(area)}
                  onChange={() => toggleArea(area)}
                />
                {area}
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={formState.consent}
            onChange={(e) => setFormState({ ...formState, consent: e.target.checked })}
            required
          />
          <span>Ho letto e accetto privacy e termini.</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2 rounded"
        >
          {loading ? "Invio..." : "Invia richiesta"}
        </button>
      </form>
    </div>
  );
}
