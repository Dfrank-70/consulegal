'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ExpertCase {
  id: string;
  userId: string;
  conversationId: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  user?: { email: string };
}

export default function ExpertCasesPage() {
  const [cases, setCases] = useState<ExpertCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/expert/cases?status=WAITING_EXPERT');
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Errore nel caricamento dei cases');
      }

      const data = await res.json();
      setCases(data);
      setLastUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Caricamento...</div>;

  return (
    <div className="h-full p-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Cases (Expert)</h1>
          <p className="text-slate-400 mt-2">Richieste assegnate in attesa di risposta</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {lastUpdatedAt && (
            <span className="text-xs text-slate-400">Ultimo aggiornamento: {lastUpdatedAt.toLocaleTimeString('it-IT')}</span>
          )}
          <button
            onClick={fetchCases}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Controlla nuove richieste
          </button>
          <Link href="/dashboard" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
            ← Torna al Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>
      )}

      <div className="bg-slate-700 shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-slate-600">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Priorità</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Utente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Creato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-slate-700 divide-y divide-slate-600">
            {cases.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">{c.priority}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{c.user?.email || c.userId}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {new Date(c.createdAt).toLocaleString('it-IT')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link href={`/dashboard/expert/cases/${c.id}` as any} className="text-blue-400 hover:text-blue-300">
                    Dettagli
                  </Link>
                </td>
              </tr>
            ))}

            {cases.length === 0 && (
              <tr>
                <td className="px-6 py-8 text-sm text-slate-300" colSpan={5}>
                  Nessun case assegnato in stato WAITING_EXPERT.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
