'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Log {
  id: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  success: boolean;
  startedAt: string;
  endedAt: string;
  input: string;
  output: string;
  error?: string;
  steps?: any[];
  totalCost: number;
  totalTokens: number;
  user: {
    id: string;
    email: string;
  };
}

export default function MonitoringPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/admin/monitoring');
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei log');
      }
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const ExpandableContent = ({ content, sectionId, limit = 150 }: { content: string; sectionId: string; limit?: number }) => {
    const isExpanded = expandedSections[sectionId] || false;

    if (!content || content.length <= limit) {
      return <pre className="bg-slate-900 p-3 rounded-md text-xs text-slate-200 whitespace-pre-wrap">{content || 'N/A'}</pre>;
    }

    return (
      <div className="relative">
        <pre className="bg-slate-900 p-3 rounded-md text-xs text-slate-200 whitespace-pre-wrap">
          {isExpanded ? content : `${content.substring(0, limit)}...`}
        </pre>
        <button onClick={() => toggleSection(sectionId)} className="text-blue-400 hover:text-blue-300 text-xs mt-1">
          {isExpanded ? 'Mostra meno' : 'Mostra di più'}
        </button>
      </div>
    );
  };

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="h-full p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Monitoring Esecuzioni</h1>
          <p className="text-slate-400 mt-2">Visualizza i log di esecuzione dei workflow</p>
        </div>
        <Link href="/dashboard/admin" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">← Torna al Dashboard</Link>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>
      )}

      <div className="bg-slate-700 shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-slate-600">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Workflow</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Utente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Statistiche</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-slate-700 divide-y divide-slate-600">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {log.success ? 'Successo' : 'Fallito'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">{log.workflowName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{log.user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{new Date(log.startedAt).toLocaleString('it-IT')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{log.totalTokens} token • ${log.totalCost.toFixed(4)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button onClick={() => setSelectedLog(log)} className="text-blue-400 hover:text-blue-300">Dettagli</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-70 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-8 border border-slate-600 w-full max-w-4xl shadow-lg rounded-md bg-slate-800">
            <div className="absolute top-4 right-4">
              <button onClick={() => { setSelectedLog(null); setExpandedSections({}); }} className="text-gray-400 hover:text-white font-bold py-2 px-4">✕</button>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-medium text-slate-100 mb-4">Dettagli Esecuzione</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-300">
                <div>
                  <p><strong>ID Log:</strong> {selectedLog.id}</p>
                  <p><strong>Workflow:</strong> {selectedLog.workflowName}</p>
                  <p><strong>Utente:</strong> {selectedLog.user.email}</p>
                  <p><strong>Data:</strong> {new Date(selectedLog.startedAt).toLocaleString('it-IT')}</p>
                  <p><strong>Stato:</strong> {selectedLog.success ? 'Successo' : 'Fallito'}</p>
                </div>
                <div>
                  <p><strong>Token Totali:</strong> {selectedLog.totalTokens}</p>
                  <p><strong>Costo Stimato:</strong> ${selectedLog.totalCost.toFixed(6)}</p>
                  <p><strong>Steps Eseguiti:</strong> {selectedLog.steps?.length || 0}</p>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="font-medium text-slate-100 mb-2">Input</h4>
                <ExpandableContent content={selectedLog.input} sectionId={`log-input-${selectedLog.id}`} />
              </div>

              <div className="mt-4">
                <h4 className="font-medium text-slate-100 mb-2">Output</h4>
                <ExpandableContent content={selectedLog.output} sectionId={`log-output-${selectedLog.id}`} />
              </div>

              {selectedLog.error && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-500 mb-2">Errore</h4>
                  <pre className="bg-red-900/50 p-3 rounded-md text-xs text-red-300 max-h-32 overflow-y-auto">{selectedLog.error}</pre>
                </div>
              )}

              {selectedLog.steps && selectedLog.steps.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-slate-100 mb-2">Steps Dettagliati</h4>
                  <div className="space-y-2 text-xs max-h-64 overflow-y-auto pr-2">
                    {selectedLog.steps.map((step: any, index: number) => (
                      <div key={index} className="bg-slate-700 p-3 rounded-md border border-slate-600">
                        <p><strong>Nodo:</strong> {step.nodeId} ({step.type})</p>
                        <p><strong>Provider:</strong> {step.provider || 'N/A'}</p>
                        <div className="mt-2">
                          <p className="font-medium mb-1">Input</p>
                          <ExpandableContent content={step.input} sectionId={`step-input-${selectedLog.id}-${index}`} />
                        </div>
                        <div className="mt-2">
                          <p className="font-medium mb-1">Output</p>
                          <ExpandableContent content={step.output} sectionId={`step-output-${selectedLog.id}-${index}`} />
                        </div>
                        <p className="mt-2"><strong>Statistiche:</strong> {step.tokensIn + step.tokensOut} token • ${step.cost.toFixed(6)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
