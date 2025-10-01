'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Provider {
  id: string;
  name: string;
  isActive: boolean;
  config?: any;
}

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    apiKey: '',
    isActive: true,
    config: '{}'
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/llm-providers');
      if (!response.ok) {
        throw new Error('Errore nel caricamento dei provider');
      }
      const data = await response.json();
      setProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (provider?: Provider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        name: provider.name,
        apiKey: '',
        isActive: provider.isActive,
        config: JSON.stringify(provider.config || {}, null, 2)
      });
    } else {
      setEditingProvider(null);
      setFormData({
        name: '',
        apiKey: '',
        isActive: true,
        config: '{}'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProvider(null);
  };

  const handleSave = async () => {
    try {
      let config;
      try {
        config = JSON.parse(formData.config);
      } catch {
        alert('Configurazione JSON non valida');
        return;
      }

      const url = editingProvider ? `/api/admin/llm-providers/${editingProvider.id}` : '/api/admin/llm-providers';
      const method = editingProvider ? 'PUT' : 'POST';

      const body: any = {
        name: formData.name,
        isActive: formData.isActive,
        config
      };

      if (formData.apiKey) {
        body.apiKey = formData.apiKey;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel salvataggio');
      }

      await fetchProviders();
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore nel salvataggio');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo provider?')) return;

    try {
      const response = await fetch(`/api/admin/llm-providers/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Errore nell\'eliminazione del provider');
      }
      setProviders(providers.filter(p => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore nell\'eliminazione');
    }
  };

  const handleToggle = async (provider: Provider) => {
    try {
      const response = await fetch(`/api/admin/llm-providers/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !provider.isActive }),
      });

      if (!response.ok) {
        throw new Error('Errore nell\'aggiornamento del provider');
      }

      await fetchProviders();
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
          <h1 className="text-3xl font-bold text-slate-100">Provider LLM</h1>
          <p className="text-slate-400 mt-2">Configura i provider di intelligenza artificiale</p>
        </div>
        <div className="flex space-x-4">
          <Link href="/dashboard/admin" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">← Torna al Dashboard</Link>
          <button onClick={() => openModal()} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">+ Nuovo Provider</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>
      )}

      <div className="bg-slate-700 shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-slate-600">
          {providers.length === 0 ? (
            <li className="px-6 py-8 text-center text-slate-400">Nessun provider configurato.</li>
          ) : (
            providers.map((provider) => (
              <li key={provider.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-slate-100">
                        {provider.name}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${provider.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {provider.isActive ? 'Attivo' : 'Inattivo'}
                        </span>
                      </h3>
                    </div>
                    <div className="flex items-center mt-2 text-sm text-slate-400 space-x-4">
                      <span>Config: {Object.keys(provider.config || {}).length} parametri</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleToggle(provider)} className={`font-bold py-1 px-3 rounded text-sm ${provider.isActive ? 'bg-red-500 hover:bg-red-700 text-white' : 'bg-green-500 hover:bg-green-700 text-white'}`}>
                      {provider.isActive ? 'Disattiva' : 'Attiva'}
                    </button>
                    <button onClick={() => openModal(provider)} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm">Modifica</button>
                    <button onClick={() => handleDelete(provider.id)} className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm">Elimina</button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-slate-600 w-96 shadow-lg rounded-md bg-slate-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-slate-100 mb-4">{editingProvider ? 'Modifica Provider' : 'Nuovo Provider'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Nome Provider</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full bg-slate-700 border border-slate-500 rounded-md px-3 py-2 text-slate-100" placeholder="Es. OpenAI, Claude, etc." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">API Key</label>
                  <input type="password" value={formData.apiKey} onChange={(e) => setFormData({...formData, apiKey: e.target.value})} className="mt-1 block w-full bg-slate-700 border border-slate-500 rounded-md px-3 py-2 text-slate-100" placeholder={editingProvider ? 'Lascia vuoto per non modificare' : 'sk-...'} />
                </div>
                <div>
                  <label className="flex items-center">
                    <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({...formData, isActive: e.target.checked})} className="mr-2" />
                    <span className="text-sm font-medium text-slate-300">Provider attivo</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Configurazione (JSON)</label>
                  <textarea value={formData.config} onChange={(e) => setFormData({...formData, config: e.target.value})} className="mt-1 block w-full bg-slate-700 border border-slate-500 rounded-md px-3 py-2 text-slate-100" rows={4} placeholder='{"baseURL": "https://api.openai.com/v1"}' />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button onClick={closeModal} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">Annulla</button>
                <button onClick={handleSave} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">{editingProvider ? 'Aggiorna' : 'Crea'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
