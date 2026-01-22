'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Config = {
  id: string;
  isActive: boolean;
  provider: string;
  model: string;
  customInstruction: string;
  maxOutputTokens: number;
  createdAt: string;
  updatedAt: string;
};

export default function ExpertAssistantSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [customInstruction, setCustomInstruction] = useState('');
  const [maxOutputTokens, setMaxOutputTokens] = useState(800);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/admin/expert-assistant-config');
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Errore nel caricamento');
      }
      const cfg: Config = await res.json();

      setProvider(cfg.provider || 'openai');
      setModel(cfg.model || 'gpt-4o-mini');
      setCustomInstruction(cfg.customInstruction || '');
      setMaxOutputTokens(typeof cfg.maxOutputTokens === 'number' ? cfg.maxOutputTokens : 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch('/api/admin/expert-assistant-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          customInstruction,
          maxOutputTokens,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Errore nel salvataggio');
      }

      setSuccess('Impostazioni salvate.');
      await fetchConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Caricamento...</div>;

  return (
    <div className="h-full p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Expert Assistant Settings</h1>
          <p className="text-slate-400 mt-2">Configura provider/modello/istruzioni usati per la sintesi on-demand nel pannello expert</p>
        </div>
        <Link href="/dashboard/admin" className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
          ← Torna al Dashboard
        </Link>
      </div>

      {(error || success) && (
        <div className={`${error ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-800'} border px-4 py-3 rounded mb-6`}>
          {error || success}
        </div>
      )}

      <div className="bg-slate-700 p-6 rounded-lg border border-slate-600 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Provider</label>
          <select
            className="w-full rounded-md bg-slate-900 border border-slate-600 text-slate-100 px-3 py-2"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="openai">openai</option>
            <option value="claude">claude</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">Nota: la disponibilità reale dipende dai provider configurati in DB.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Model</label>
          <input
            className="w-full rounded-md bg-slate-900 border border-slate-600 text-slate-100 px-3 py-2"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Max output tokens</label>
          <input
            type="number"
            className="w-full rounded-md bg-slate-900 border border-slate-600 text-slate-100 px-3 py-2"
            value={maxOutputTokens}
            onChange={(e) => setMaxOutputTokens(parseInt(e.target.value || '0', 10))}
            min={1}
            max={4000}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Custom instruction (obbligatoria)</label>
          <textarea
            className="w-full min-h-[260px] p-3 rounded-md bg-slate-900 border border-slate-600 text-slate-100"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="Inserisci instruction..."
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving || customInstruction.trim().length === 0}
            className={`font-bold py-2 px-4 rounded ${saving || customInstruction.trim().length === 0 ? 'bg-blue-400/40 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {saving ? 'Salvo...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
