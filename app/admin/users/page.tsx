'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  customInstructions?: string;
  subscription?: {
    id: string;
    status: string;
    tokenLimit: number;
    createdAt: string;
  };
  workflow?: {
    id: string;
    name: string;
    description?: string;
    isDefault: boolean;
  };
  _count: {
    conversations: number;
  };
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    fetchUsers();
    fetchWorkflows();
  }, [session, status, router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Errore nel caricamento degli utenti');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/admin/workflows');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei workflow:', error);
    }
  };

  const assignWorkflow = async (userId: string, workflowId: string | null) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/workflow`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workflowId }),
      });

      if (!response.ok) {
        throw new Error('Errore nell\'assegnazione del workflow');
      }

      // Aggiorna la lista degli utenti
      await fetchUsers();
      setShowWorkflowModal(false);
      setSelectedUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore nell\'assegnazione');
    }
  };

  const toggleUserBlock = async (userId: string, isBlocked: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isBlocked: !isBlocked }),
      });

      if (!response.ok) {
        throw new Error('Errore nell\'aggiornamento dell\'utente');
      }

      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore nell\'aggiornamento');
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
              <h1 className="text-3xl font-bold text-gray-900">Gestione Utenti</h1>
              <p className="text-gray-600 mt-2">Gestisci utenti e assegna workflow personalizzati</p>
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

          {/* Users Table */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abbonamento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Workflow Assegnato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attività
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className={user.isBlocked ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.email}</div>
                        <div className="text-sm text-gray-500">
                          {user.role} • Registrato: {new Date(user.createdAt).toLocaleDateString('it-IT')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.subscription ? (
                        <div>
                          <div className="text-sm text-gray-900">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.subscription.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {user.subscription.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.subscription.tokenLimit.toLocaleString('it-IT')} token/giorno
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Nessun abbonamento</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.workflow ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.workflow.name}
                            {user.workflow.isDefault && (
                              <span className="ml-1 text-xs text-gray-500">(Default)</span>
                            )}
                          </div>
                          {user.workflow.description && (
                            <div className="text-sm text-gray-500">{user.workflow.description}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Workflow di default</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user._count.conversations} conversazioni
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isBlocked 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {user.isBlocked ? 'Bloccato' : 'Attivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowWorkflowModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Assegna Workflow
                      </button>
                      <button
                        onClick={() => toggleUserBlock(user.id, user.isBlocked)}
                        className={user.isBlocked ? 'text-green-600 hover:text-green-900' : 'text-red-600 hover:text-red-900'}
                      >
                        {user.isBlocked ? 'Sblocca' : 'Blocca'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal per assegnazione workflow */}
      {showWorkflowModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Assegna Workflow a {selectedUser.email}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="workflow"
                      value=""
                      checked={!selectedUser.workflow}
                      onChange={() => assignWorkflow(selectedUser.id, null)}
                      className="mr-2"
                    />
                    <span className="text-sm">Usa workflow di default</span>
                  </label>
                </div>
                
                {workflows.map((workflow) => (
                  <div key={workflow.id}>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="workflow"
                        value={workflow.id}
                        checked={selectedUser.workflow?.id === workflow.id}
                        onChange={() => assignWorkflow(selectedUser.id, workflow.id)}
                        className="mr-2"
                      />
                      <div>
                        <span className="text-sm font-medium">{workflow.name}</span>
                        {workflow.isDefault && (
                          <span className="ml-1 text-xs text-gray-500">(Default)</span>
                        )}
                        {workflow.description && (
                          <div className="text-xs text-gray-500">{workflow.description}</div>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowWorkflowModal(false);
                    setSelectedUser(null);
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
