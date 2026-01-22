'use client';

import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  return (
    <div className="h-full p-8">
      <div className="border-4 border-dashed border-slate-600 rounded-lg p-8">
        <h1 className="text-3xl font-bold text-slate-100 mb-8">
          LLM Workflow Admin
        </h1>
        <p className="text-slate-300 mb-8">
          Benvenuto nel pannello di amministrazione di Traspolegal Platform
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin')}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Dashboard</h3>
            </div>
            <p className="text-slate-300">Panoramica generale del sistema</p>
          </div>

          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin/workflows')}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Gestione Workflow</h3>
            </div>
            <p className="text-slate-300">Crea e modifica workflow AI</p>
          </div>

          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin/users')}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Gestione Utenti</h3>
            </div>
            <p className="text-slate-300">Gestisci utenti e assegna workflow</p>
          </div>

          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin/providers')}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Provider LLM</h3>
            </div>
            <p className="text-slate-300">Configura provider di intelligenza artificiale</p>
          </div>

          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin/expert-assistant')}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-teal-100 rounded-lg">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Expert Assistant</h3>
            </div>
            <p className="text-slate-300">Impostazioni sintesi LLM on-demand per il pannello expert</p>
          </div>

          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin/monitoring')}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Monitoring</h3>
            </div>
            <p className="text-slate-300">Monitora performance e debug</p>
          </div>

          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin/cases' as any)}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Cases</h3>
            </div>
            <p className="text-slate-300">Gestisci richieste in attesa di esperto</p>
          </div>

          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin/file-limits')}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Limiti Upload File</h3>
            </div>
            <p className="text-slate-300">Configura limiti per piano servizio</p>
          </div>

          <div 
            className="bg-slate-700 p-6 rounded-lg shadow cursor-pointer hover:bg-slate-600 transition-shadow"
            onClick={() => router.push('/dashboard/admin/config' as any)}
          >
            <div className="flex items-center mb-4">
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-slate-100">Config Globale</h3>
            </div>
            <p className="text-slate-300">Configurazioni di sistema</p>
          </div>
        </div>
      </div>
    </div>
  );
}
