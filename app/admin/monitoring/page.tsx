'use client';

import { useSession } from 'next-auth/react';
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
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    fetchLogs();
  }, [session, status, router]);

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

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
  }

  if (!session || session.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Monitoring Esecuzioni</h1>
              <p className="text-gray-600 mt-2">Visualizza i log di esecuzione dei workflow</p>
            </div>
            <Link
              href="/admin"
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

          {/* Logs Table */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statistiche</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        log.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.success ? 'Successo' : 'Fallito'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.workflowName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.startedAt).toLocaleString('it-IT')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.totalTokens} token • ${log.totalCost.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Dettagli
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Dettagli Log */}
      {selectedLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-500 hover:text-gray-800 font-bold py-2 px-4"
              >
                ✕
              </button>
            </div>
            <div className="mt-3">
              <h3 className="text-xl font-medium text-gray-900 mb-4">Dettagli Esecuzione</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
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
                <h4 className="font-medium text-gray-900 mb-2">Input</h4>
                <pre className="bg-gray-100 p-3 rounded-md text-xs max-h-32 overflow-y-auto">{selectedLog.input}</pre>
              </div>

              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Output</h4>
                <pre className="bg-gray-100 p-3 rounded-md text-xs max-h-32 overflow-y-auto">{selectedLog.output}</pre>
              </div>

              {selectedLog.error && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-700 mb-2">Errore</h4>
                  <pre className="bg-red-50 p-3 rounded-md text-xs text-red-800 max-h-32 overflow-y-auto">{selectedLog.error}</pre>
                </div>
              )}

              {selectedLog.steps && selectedLog.steps.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Steps Dettagliati</h4>
                  <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
                    {selectedLog.steps.map((step: any, index: number) => (
                      <div key={index} className="bg-gray-50 p-2 rounded-md">
                        <p><strong>Nodo:</strong> {step.nodeId} ({step.type})</p>
                        <p><strong>Provider:</strong> {step.provider || 'N/A'}</p>
                        <p><strong>Input:</strong> <span className="truncate">{step.input.substring(0, 100)}...</span></p>
                        <p><strong>Output:</strong> <span className="truncate">{step.output.substring(0, 100)}...</span></p>
                        <p><strong>Statistiche:</strong> {step.tokensIn + step.tokensOut} token • ${step.cost.toFixed(6)}</p>
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
