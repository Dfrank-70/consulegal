'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface CaseMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  author?: { id: string; email: string };
}

interface AdminCaseDetail {
  id: string;
  userId: string;
  conversationId: string;
  assignedToId?: string | null;
  status: string;
  priority: string;
  triggeredBy: string;
  expertPacket: any;
  createdAt: string;
  updatedAt: string;
  user?: { email: string };
  assignedTo?: { id: string; email: string; name: string | null } | null;
  messages: CaseMessage[];
}

interface ExpertUser {
  id: string;
  email: string;
  name: string | null;
}

export default function AdminCaseDetailPage() {
  const params = useParams();
  const caseId = (params as any)?.id as string | undefined;

  const [data, setData] = useState<AdminCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [experts, setExperts] = useState<ExpertUser[]>([]);
  const [selectedExpertId, setSelectedExpertId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    fetchCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const fetchCase = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/admin/cases/${caseId}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Errore nel caricamento del case');
      }

      const json = await res.json();
      setData(json);
      setSelectedExpertId(json?.assignedToId || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const fetchExperts = async () => {
    try {
      const res = await fetch('/api/admin/experts');
      if (!res.ok) return;
      const json = await res.json();
      setExperts(Array.isArray(json?.experts) ? json.experts : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchExperts();
  }, []);

  const assignToExpert = async () => {
    if (!caseId || !selectedExpertId) return;

    try {
      setAssigning(true);
      setSuccess(null);

      const res = await fetch(`/api/admin/cases/${caseId}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: selectedExpertId }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Errore durante assegnazione');
      }

      setSuccess('Case assegnato.');
      await fetchCase();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setAssigning(false);
    }
  };

  const sendReply = async () => {
    if (!caseId) return;

    try {
      setSending(true);
      setSuccess(null);

      const res = await fetch(`/api/admin/cases/${caseId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Errore durante invio risposta');
      }

      setReply('');
      setSuccess('Risposta inviata.');
      await fetchCase();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="h-full p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Case</h1>
          <p className="text-slate-400 mt-2">Dettaglio richiesta</p>
        </div>
        <Link href="/dashboard/admin/cases" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
          ← Torna alla lista
        </Link>
      </div>

      {(error || success) && (
        <div className={`${error ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-800'} border px-4 py-3 rounded mb-6`}>
          {error || success}
        </div>
      )}

      {!data ? (
        <div className="text-slate-200">Case non trovato</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-200">
              <div>
                <p><strong>ID:</strong> {data.id}</p>
                <p><strong>Utente:</strong> {data.user?.email || data.userId}</p>
                <p><strong>Conversation:</strong> {data.conversationId}</p>
              </div>
              <div>
                <p><strong>Stato:</strong> {data.status}</p>
                <p><strong>Priorità:</strong> {data.priority}</p>
                <p><strong>Creato:</strong> {new Date(data.createdAt).toLocaleString('it-IT')}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Assegnazione</h2>
            <div className="text-sm text-slate-200 mb-2">
              <strong>Assegnato a:</strong> {data.assignedTo?.email || 'Non assegnato'}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <select
                className="w-full sm:w-96 rounded-md bg-slate-900 border border-slate-600 text-slate-100 px-3 py-2"
                value={selectedExpertId}
                onChange={(e) => setSelectedExpertId(e.target.value)}
              >
                <option value="">Seleziona esperto...</option>
                {experts.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.email}{ex.name ? ` (${ex.name})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={assignToExpert}
                disabled={assigning || !selectedExpertId || selectedExpertId === (data.assignedToId || '')}
                className={`font-bold py-2 px-4 rounded ${assigning || !selectedExpertId || selectedExpertId === (data.assignedToId || '') ? 'bg-blue-400/40 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                {assigning ? 'Assegno...' : 'Assegna'}
              </button>
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Dossier Esperto</h2>
            <pre className="bg-slate-900 p-3 rounded-md text-xs text-slate-200 whitespace-pre-wrap">
              {JSON.stringify(data.expertPacket ?? null, null, 2)}
            </pre>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Messaggi Case</h2>
            <div className="space-y-3">
              {data.messages.map((m) => (
                <div key={m.id} className="bg-slate-800 border border-slate-600 rounded-md p-4">
                  <div className="text-xs text-slate-400 mb-2">
                    {m.role} • {m.author?.email || 'SYSTEM'} • {new Date(m.createdAt).toLocaleString('it-IT')}
                  </div>
                  <div className="text-sm text-slate-100 whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}

              {data.messages.length === 0 && (
                <div className="text-sm text-slate-300">Nessun messaggio case.</div>
              )}
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Invia risposta esperto</h2>
            <textarea
              className="w-full min-h-[140px] p-3 rounded-md bg-slate-900 border border-slate-600 text-slate-100"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Scrivi la risposta dell'esperto..."
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={sendReply}
                disabled={sending || reply.trim().length === 0}
                className={`font-bold py-2 px-4 rounded ${sending || reply.trim().length === 0 ? 'bg-blue-400/40 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                {sending ? 'Invio...' : 'Invia risposta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
