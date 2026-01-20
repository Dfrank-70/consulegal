'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { subscriptionPlans } from '@/config/subscriptions';

interface PlanLimits {
  stripeProductId: string | null;
  tokenLimit: number;
  maxFileBytes: number;
  maxAttachmentChars: number;
  count: number;
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    status: string;
  }>;
}

export default function FileLimitsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [planGroups, setPlanGroups] = useState<Record<string, PlanLimits>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, PlanLimits>>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/admin/subscriptions');
      const data = await res.json();
      setPlanGroups(data.planGroups || {});
      setEditValues(data.planGroups || {});
    } catch (error) {
      console.error('Error fetching plan limits:', error);
    } finally {
      setLoading(false);
    }
  }

  async function savePlanLimits(stripeProductId: string) {
    setSaving(stripeProductId);
    try {
      const limits = editValues[stripeProductId];
      const res = await fetch('/api/admin/subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeProductId,
          tokenLimit: limits.tokenLimit,
          maxFileBytes: limits.maxFileBytes,
          maxAttachmentChars: limits.maxAttachmentChars
        })
      });

      if (!res.ok) throw new Error('Failed to update limits');

      await fetchData();
      alert('✅ Limiti aggiornati con successo');
    } catch (error) {
      alert('❌ Errore nell\'aggiornamento dei limiti');
      console.error(error);
    } finally {
      setSaving(null);
    }
  }

  function updateEditValue(planKey: string, field: keyof PlanLimits, value: number) {
    setEditValues(prev => ({
      ...prev,
      [planKey]: {
        ...prev[planKey],
        [field]: value
      }
    }));
  }

  function formatBytes(bytes: number): string {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  function getPlanName(stripeProductId: string | null): { name: string; id: string } {
    if (!stripeProductId) {
      return { name: 'Piano Sconosciuto', id: 'N/A' };
    }

    // Mappatura diretta productId → nome piano
    const productToPlanMap: Record<string, string> = {
      'prod_SX7ZfoHB5tVp24': 'ConsulLight',
      'prod_SX7aNEcKd5SkVl': 'ConsulPro', 
      'prod_SX7bqwJ5SGERJX': 'ConsulExpert'
    };

    const planName = productToPlanMap[stripeProductId];
    
    if (planName) {
      return {
        name: planName,
        id: stripeProductId.substring(5, 15)
      };
    }

    // Fallback per nuovi prodotti
    if (stripeProductId.includes('light')) return { name: 'ConsulLight', id: stripeProductId.substring(5, 15) };
    if (stripeProductId.includes('pro')) return { name: 'ConsulPro', id: stripeProductId.substring(5, 15) };
    if (stripeProductId.includes('expert')) return { name: 'ConsulExpert', id: stripeProductId.substring(5, 15) };
    
    return { name: stripeProductId.substring(0, 20), id: stripeProductId.substring(5, 15) };
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center text-white">Caricamento...</div>;
  }

  return (
    <div className="h-full p-8 bg-slate-800 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Gestione Limiti Upload File</h1>
            <p className="text-slate-400 mt-2">Configura limiti per ciascun piano di abbonamento</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/admin')}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded"
          >
            ← Indietro
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(planGroups)
            .sort(([keyA, planA], [keyB, planB]) => {
              const nameA = getPlanName(planA.stripeProductId).name;
              const nameB = getPlanName(planB.stripeProductId).name;
              
              // Ordine desiderato: Light → Expert → Pro
              const order = { 'ConsulLight': 0, 'ConsulExpert': 1, 'ConsulPro': 2 };
              const orderA = order[nameA as keyof typeof order] ?? 999;
              const orderB = order[nameB as keyof typeof order] ?? 999;
              
              return orderA - orderB;
            })
            .map(([planKey, plan]) => {
              const planInfo = getPlanName(plan.stripeProductId);
              return (
              <div key={planKey} className="bg-slate-900 rounded-lg shadow-lg p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{planInfo.name}</h2>
                    <p className="text-sm text-slate-400">{plan.count} utent{plan.count === 1 ? 'e' : 'i'} attiv{plan.count === 1 ? 'o' : 'i'}</p>
                  </div>
                  <div className="bg-blue-900/30 px-3 py-1 rounded text-blue-300 text-xs">
                    ID: {planInfo.id}
                  </div>
                </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Token Giornalieri
                  </label>
                  <input
                    type="number"
                    value={editValues[planKey]?.tokenLimit || 0}
                    onChange={(e) => updateEditValue(planKey, 'tokenLimit', parseInt(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                    min="0"
                    step="1000"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {(editValues[planKey]?.tokenLimit || 0).toLocaleString()} token/giorno
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Dimensioni File Max (MB)
                  </label>
                  <input
                    type="number"
                    value={((editValues[planKey]?.maxFileBytes || 0) / 1048576).toFixed(1)}
                    onChange={(e) => updateEditValue(planKey, 'maxFileBytes', Math.round(parseFloat(e.target.value) * 1048576))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                    min="0"
                    step="0.1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {formatBytes(editValues[planKey]?.maxFileBytes || 0)} per file
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Caratteri Max Processati
                  </label>
                  <input
                    type="number"
                    value={editValues[planKey]?.maxAttachmentChars || 0}
                    onChange={(e) => updateEditValue(planKey, 'maxAttachmentChars', parseInt(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white"
                    min="0"
                    step="5000"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {(editValues[planKey]?.maxAttachmentChars || 0).toLocaleString()} caratteri (~{Math.ceil((editValues[planKey]?.maxAttachmentChars || 0) / 4).toLocaleString()} token)
                  </p>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => savePlanLimits(plan.stripeProductId || planKey)}
                  disabled={saving === planKey}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-2 px-4 rounded"
                >
                  {saving === planKey ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
                <button
                  onClick={() => setEditValues(prev => ({ ...prev, [planKey]: planGroups[planKey] }))}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded"
                >
                  Reset
                </button>
              </div>

              <details className="mt-4">
                <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                  Mostra utenti ({plan.users.length})
                </summary>
                <div className="mt-2 space-y-1">
                  {plan.users.map(user => (
                    <div key={user.id} className="text-xs text-slate-500 flex justify-between">
                      <span>{user.email}</span>
                      <span className={user.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                        {user.status}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
            );
          })}
        </div>

        {Object.keys(planGroups).length === 0 && (
          <div className="bg-slate-900 rounded-lg p-8 text-center">
            <p className="text-slate-400">Nessun piano attivo trovato</p>
          </div>
        )}

        <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h3 className="text-blue-300 font-semibold mb-2">💡 Guida Rapida</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>• <strong>Token Giornalieri:</strong> Limite totale token per utente al giorno</li>
            <li>• <strong>Dimensione File Max:</strong> Peso massimo file caricabile (1MB = 1048576 bytes)</li>
            <li>• <strong>Caratteri Max:</strong> Caratteri processati dall'LLM (~4 caratteri = 1 token)</li>
            <li>• Valori consigliati MVP: 1MB file, 25K caratteri, 50K token/giorno</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
