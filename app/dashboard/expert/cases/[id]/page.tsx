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

interface ExpertCaseDetail {
  id: string;
  userId: string;
  conversationId: string;
  status: string;
  priority: string;
  triggeredBy: string;
  expertPacket: any;
  expertSummary?: any;
  expertSummaryProvider?: string | null;
  expertSummaryModel?: string | null;
  expertSummaryCreatedAt?: string | null;
  conversation?: {
    id: string;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
      attachments?: any;
      meta?: any;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  user?: { email: string };
  messages: CaseMessage[];
}

export default function ExpertCaseDetailPage() {
  const params = useParams();
  const caseId = (params as any)?.id as string | undefined;

  const [data, setData] = useState<ExpertCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    fetchCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const fetchCase = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/expert/cases/${caseId}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Errore nel caricamento del case');
      }

      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!caseId) return;

    try {
      setSummaryLoading(true);
      setError(null);
      setSuccess(null);

      const res = await fetch(`/api/expert/requests/${caseId}/generate-summary`, {
        method: 'POST',
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Errore durante generazione sintesi');
      }

      await fetchCase();
      setSuccess('Sintesi generata.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setSummaryLoading(false);
    }
  };

  const copyDraftToReply = () => {
    const draft = (data as any)?.expertSummary?.draft_opinion;
    if (typeof draft === 'string' && draft.trim().length > 0) {
      setReply(draft);
      setSuccess('Bozza copiata nel parere.');
    } else {
      setError('Nessuna bozza disponibile da copiare.');
    }
  };

  const conversationMessages = (data as any)?.conversation?.messages || [];
  const lastUserMsg = [...conversationMessages].reverse().find((m: any) => m.role === 'USER');
  const lastAssistantMsg = [...conversationMessages].reverse().find((m: any) => m.role === 'ASSISTANT');

  const sendReply = async () => {
    if (!caseId) return;

    try {
      setSending(true);
      setSuccess(null);

      const res = await fetch(`/api/expert/cases/${caseId}/reply`, {
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

  if (loading) return <div className="p-6">Caricamento...</div>;

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Case (Expert)</h1>
          <p className="text-slate-400 mt-2">Dettaglio richiesta assegnata</p>
        </div>
        <Link href="/dashboard/expert/cases" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
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
            <h2 className="text-lg font-semibold text-slate-100 mb-3">Conversazione (contesto completo)</h2>
            <div className="space-y-3">
              {conversationMessages.map((m: any) => {
                const authorType = m?.meta?.authorType;
                const label = authorType === 'expert' ? 'Esperto' : (m.role === 'USER' ? 'Utente' : 'AI');
                const isTarget = (lastUserMsg && m.id === lastUserMsg.id) || (lastAssistantMsg && m.id === lastAssistantMsg.id);
                const bubbleClass = m.role === 'USER'
                  ? 'bg-slate-900 border-slate-600'
                  : 'bg-slate-800 border-slate-600';

                return (
                  <div
                    key={m.id}
                    className={`${bubbleClass} border rounded-md p-4 ${isTarget ? 'ring-2 ring-yellow-500' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span>{label}</span>
                      <span>{new Date(m.createdAt).toLocaleString('it-IT')}</span>
                    </div>
                    <div className="text-sm text-slate-100 whitespace-pre-wrap">{m.content}</div>
                  </div>
                );
              })}

              {conversationMessages.length === 0 && (
                <div className="text-sm text-slate-300">Nessun messaggio nella conversazione.</div>
              )}
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Sintesi LLM (assistente esperto)</h2>
                <div className="text-xs text-slate-400 mt-1">
                  {data.expertSummaryCreatedAt
                    ? `Generata: ${new Date(data.expertSummaryCreatedAt).toLocaleString('it-IT')} • ${data.expertSummaryProvider || '—'} / ${data.expertSummaryModel || '—'}`
                    : 'Non generata'}
                </div>
              </div>
              <button
                onClick={generateSummary}
                disabled={summaryLoading}
                className={`font-bold py-2 px-4 rounded ${summaryLoading ? 'bg-blue-400/40 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                {summaryLoading ? 'Generazione...' : (data.expertSummary ? 'Rigenera sintesi' : 'Genera sintesi')}
              </button>
            </div>

            {!data.expertSummary ? (
              <div className="text-sm text-slate-300">Non generata.</div>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-600 rounded-md p-4">
                  <div className="text-sm text-slate-100 whitespace-pre-wrap">{data.expertSummary.summary || '—'}</div>
                </div>

                {Array.isArray(data.expertSummary.key_points) && (
                  <div>
                    <div className="text-sm font-semibold text-slate-100 mb-2">Punti chiave</div>
                    <ul className="text-sm text-slate-200 space-y-1">
                      {data.expertSummary.key_points.map((x: any, idx: number) => (
                        <li key={idx} className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2">{String(x)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(data.expertSummary.open_questions) && (
                  <div>
                    <div className="text-sm font-semibold text-slate-100 mb-2">Cosa manca per essere rigorosi</div>
                    <ul className="text-sm text-slate-200 space-y-1">
                      {data.expertSummary.open_questions.map((x: any, idx: number) => (
                        <li key={idx} className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2">{String(x)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(data.expertSummary.risk_flags) && (
                  <div>
                    <div className="text-sm font-semibold text-slate-100 mb-2">Rischi / red flags</div>
                    <div className="space-y-2">
                      {data.expertSummary.risk_flags.map((rf: any, idx: number) => (
                        <div key={idx} className="bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200">
                          <span className="text-slate-400">{String(rf?.level || '—')}: </span>
                          {String(rf?.text || '')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={copyDraftToReply}
                    disabled={!(typeof data.expertSummary?.draft_opinion === 'string' && data.expertSummary.draft_opinion.trim().length > 0)}
                    className={`font-bold py-2 px-4 rounded ${!(typeof data.expertSummary?.draft_opinion === 'string' && data.expertSummary.draft_opinion.trim().length > 0) ? 'bg-blue-400/40 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    Copia bozza nel parere
                  </button>
                </div>
              </div>
            )}
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

          <div className="bg-slate-700 p-6 rounded-lg border border-slate-600">
            <details>
              <summary className="cursor-pointer text-slate-100 font-semibold">Dettagli tecnici (JSON)</summary>
              <div className="mt-3">
                <pre className="bg-slate-900 p-3 rounded-md text-xs text-slate-200 whitespace-pre-wrap">
                  {JSON.stringify(data.expertPacket ?? null, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
