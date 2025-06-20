export default function FinalTest() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-blue-600 mb-8 text-center">
          Tailwind CSS Final Test
        </h1>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="bg-blue-600 p-4">
            <h2 className="text-xl font-semibold text-white">
              Configurazione ConsulLegal AI
            </h2>
          </div>
          <div className="p-6">
            <p className="text-gray-700 mb-4">
              Questa pagina utilizza tutti gli stili Tailwind per verificare che le configurazioni siano corrette.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-800 mb-2">Next.js 15</h3>
                <p className="text-green-700 text-sm">
                  Configurazione ottimizzata per Next.js 15.3.3
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-800 mb-2">Tailwind 3.4.1</h3>
                <p className="text-blue-700 text-sm">
                  Stili e configurazioni aggiornate
                </p>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Test Button
              </button>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Se questa pagina appare correttamente stilizzata, significa che Tailwind CSS funziona!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
