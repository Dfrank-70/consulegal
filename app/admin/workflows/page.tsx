'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: any[];
  edges: any[];
  users: Array<{
    id: string;
    name: string | null;
    email: string;
  }>;
}

export default function WorkflowsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    fetchWorkflows();
  }, [session, status, router]);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/admin/workflows');
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei workflow');
      }
      const data = await response.json();
      setWorkflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo workflow?')) return;

    try {
      const response = await fetch(`/api/admin/workflows/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Errore nell\'eliminazione del workflow');
      }

      setWorkflows(workflows.filter(w => w.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore nell\'eliminazione');
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
              <h1 className="text-3xl font-bold text-gray-900">Gestione Workflow</h1>
              <p className="text-gray-600 mt-2">Crea e gestisci i workflow AI per gli utenti</p>
            </div>
            <div className="flex space-x-4">
              <Link
                href="/admin"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                ← Torna al Dashboard
              </Link>
              <Link
                href="/admin/workflows/new"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                + Nuovo Workflow
              </Link>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Workflows List */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {workflows.length === 0 ? (
                <li className="px-6 py-8 text-center text-gray-500">
                  Nessun workflow configurato. Crea il primo workflow per iniziare.
                </li>
              ) : (
                workflows.map((workflow) => (
                  <li key={workflow.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-gray-900">
                            {workflow.name}
                            {workflow.isDefault && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Default
                              </span>
                            )}
                          </h3>
                        </div>
                        {workflow.description && (
                          <p className="text-gray-600 mt-1">{workflow.description}</p>
                        )}
                        <div className="flex items-center mt-2 text-sm text-gray-500 space-x-4">
                          <span>{workflow.nodes.length} nodi</span>
                          <span>{workflow.edges.length} connessioni</span>
                          <span>{workflow.users.length} utenti assegnati</span>
                          <span>Creato: {new Date(workflow.createdAt).toLocaleDateString('it-IT')}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/admin/workflows/${workflow.id}`}
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm"
                        >
                          Modifica
                        </Link>
                        <button
                          onClick={() => deleteWorkflow(workflow.id)}
                          className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
                          disabled={workflow.isDefault && workflows.length === 1}
                        >
                          Elimina
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
