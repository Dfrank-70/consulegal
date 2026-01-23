'use client';

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
  defaultExpertId?: string | null;
  defaultExpert?: { id: string; email: string; name: string | null } | null;
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

interface ExpertUser {
  id: string;
  email: string;
  name: string | null;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [tempWorkflowId, setTempWorkflowId] = useState<string | null>(null);
  const [experts, setExperts] = useState<ExpertUser[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchWorkflows();
    fetchExperts();
  }, []);

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

  const fetchExperts = async () => {
    try {
      const response = await fetch('/api/admin/experts');
      if (response.ok) {
        const data = await response.json();
        setExperts(Array.isArray(data?.experts) ? data.experts : []);
      }
    } catch (error) {
      console.error('Errore nel caricamento degli esperti:', error);
    }
  };

  const assignDefaultExpert = async (userId: string, defaultExpertId: string | null) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ defaultExpertId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Errore nell\'assegnazione esperto');
      }

      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore nell\'assegnazione');
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

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="h-full p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Gestione Utenti</h1>
          <p className="text-slate-400 mt-2">Gestisci utenti e assegna workflow personalizzati</p>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Utente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Abbonamento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Workflow Assegnato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Esperto di riferimento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Attività</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Stato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-slate-700 divide-y divide-slate-600">
            {users.map((user) => (
              <tr key={user.id} className={user.isBlocked ? 'bg-red-900/50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-slate-100">{user.email}</div>
                    <div className="text-sm text-slate-400">
                      {user.role} • Registrato: {new Date(user.createdAt).toLocaleDateString('it-IT')}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.subscription ? (
                    <div>
                      <div className="text-sm text-slate-100">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {user.subscription.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {user.subscription.tokenLimit.toLocaleString('it-IT')} token/giorno
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Nessun abbonamento</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.workflow ? (
                    <div>
                      <div className="text-sm font-medium text-slate-100">
                        {user.workflow.name}
                        {user.workflow.isDefault && (
                          <span className="ml-1 text-xs text-slate-500">(Default)</span>
                        )}
                      </div>
                      {user.workflow.description && (
                        <div className="text-sm text-slate-400">{user.workflow.description}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Workflow di default</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.role === 'CUSTOMER' ? (
                    <div className="space-y-1">
                      <div className="text-sm text-slate-100">
                        {user.defaultExpert?.email || 'Non assegnato'}
                      </div>
                      <select
                        className="mt-1 block w-full bg-slate-800 border border-slate-600 rounded-md px-2 py-1 text-xs text-slate-100"
                        value={user.defaultExpertId ?? ''}
                        onChange={(e) => assignDefaultExpert(user.id, e.target.value || null)}
                      >
                        <option value="">Non assegnato</option>
                        {experts.map((expert) => (
                          <option key={expert.id} value={expert.id}>
                            {expert.email}{expert.name ? ` (${expert.name})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {user._count.conversations} conversazioni
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                    {user.isBlocked ? 'Bloccato' : 'Attivo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button onClick={() => { setSelectedUser(user); setTempWorkflowId(user.workflow?.id ?? null); setShowWorkflowModal(true); }} className="text-blue-400 hover:text-blue-300">Assegna Workflow</button>
                  <button onClick={() => toggleUserBlock(user.id, user.isBlocked)} className={user.isBlocked ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'}>
                    {user.isBlocked ? 'Sblocca' : 'Blocca'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showWorkflowModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-slate-600 w-96 shadow-lg rounded-md bg-slate-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-slate-100 mb-4">Assegna Workflow a {selectedUser.email}</h3>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center">
                    <input type="radio" name="workflow" value="" checked={tempWorkflowId === null} onChange={() => setTempWorkflowId(null)} className="mr-2" />
                    <span className="text-sm text-slate-200">Usa workflow di default</span>
                  </label>
                </div>
                {workflows.filter((w) => !w.name.startsWith('system_')).map((workflow) => (
                  <div key={workflow.id}>
                    <label className="flex items-center">
                      <input type="radio" name="workflow" value={workflow.id} checked={tempWorkflowId === workflow.id} onChange={() => setTempWorkflowId(workflow.id)} className="mr-2" />
                      <div>
                        <span className="text-sm font-medium text-slate-200">{workflow.name}</span>
                        {workflow.isDefault && (
                          <span className="ml-1 text-xs text-slate-500">(Default)</span>
                        )}
                        {workflow.description && (
                          <div className="text-xs text-slate-400">{workflow.description}</div>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={() => { setShowWorkflowModal(false); setSelectedUser(null); }} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Annulla</button>
                <button
                  onClick={() => assignWorkflow(selectedUser.id, tempWorkflowId)}
                  disabled={(selectedUser.workflow?.id ?? null) === tempWorkflowId}
                  className={`font-bold py-2 px-4 rounded ${((selectedUser.workflow?.id ?? null) === tempWorkflowId) ? 'bg-blue-400/40 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
