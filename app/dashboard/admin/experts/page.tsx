"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ExpertRequest {
  id: string;
  userId: string;
  fullName: string;
  firmName?: string | null;
  phone?: string | null;
  practiceAreas: string[];
  status: string;
  createdAt: string;
  user: { email: string };
}

export default function ExpertRequestsPage() {
  const [requests, setRequests] = useState<ExpertRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/experts/requests");
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Errore nel caricamento");
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    try {
      const approvalNotes = action === "reject" ? window.prompt("Note rifiuto (opzionali)") || null : null;
      const res = await fetch(`/api/admin/experts/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, approvalNotes }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Errore nella richiesta");
      }

      await fetchRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore imprevisto");
    }
  };

  if (loading) return <div className="p-6">Caricamento...</div>;

  return (
    <div className="h-full p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Richieste Esperti</h1>
          <p className="text-slate-400 mt-2">Valuta e approva i candidati esperti</p>
        </div>
        <Link
          href="/dashboard/admin"
          className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          ← Torna al Dashboard
        </Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="bg-slate-700 shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-slate-600">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Esperto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Aree</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Creato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-slate-700 divide-y divide-slate-600">
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="px-6 py-4 text-sm text-slate-100">
                  <div className="font-semibold">{request.fullName}</div>
                  <div className="text-slate-400">{request.user.email}</div>
                  {request.firmName && <div className="text-slate-400">{request.firmName}</div>}
                </td>
                <td className="px-6 py-4 text-sm text-slate-300">
                  {request.practiceAreas.length > 0 ? request.practiceAreas.join(", ") : "—"}
                </td>
                <td className="px-6 py-4 text-sm text-slate-300">{request.status}</td>
                <td className="px-6 py-4 text-sm text-slate-400">
                  {new Date(request.createdAt).toLocaleDateString("it-IT")}
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    className="text-green-400 hover:text-green-300"
                    onClick={() => handleAction(request.id, "approve")}
                  >
                    Approva
                  </button>
                  <button
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleAction(request.id, "reject")}
                  >
                    Rifiuta
                  </button>
                </td>
              </tr>
            ))}

            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-sm text-slate-300">
                  Nessuna richiesta in attesa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
