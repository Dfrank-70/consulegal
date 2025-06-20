'use client';

import { useEffect } from 'react';

export default function DiagnosePage() {
  useEffect(() => {
    // Controlla se Tailwind è caricato analizzando gli stili computati
    const styleTest = document.createElement('div');
    styleTest.className = 'text-blue-500';
    document.body.appendChild(styleTest);
    
    const styles = window.getComputedStyle(styleTest);
    const hasColor = styles.color !== 'rgb(0, 0, 0)';
    
    console.log('Diagnostica Tailwind CSS:');
    console.log('- Classe text-blue-500 applicata?', hasColor);
    console.log('- Colore computato:', styles.color);
    console.log('- Fogli di stile caricati:', document.styleSheets.length);
    
    // Elenca tutti i fogli di stile presenti
    console.log('Fogli di stile disponibili:');
    try {
      Array.from(document.styleSheets).forEach((sheet, i) => {
        try {
          console.log(`- Foglio ${i}:`, sheet.href || 'inline style');
        } catch (e) {
          console.log(`- Foglio ${i}: Accesso negato (CORS)`, e);
        }
      });
    } catch (e) {
      console.log('Errore nell\'elencare i fogli di stile:', e);
    }
    
    document.body.removeChild(styleTest);
  }, []);
  
  return (
    <div className="min-h-screen p-10">
      <h1 className="text-3xl font-bold text-blue-500 mb-4">Test Diagnostica Tailwind CSS</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-100 p-6 rounded-lg shadow">
          <h2 className="text-xl font-medium mb-2">Test Base</h2>
          <p className="text-gray-600">Questo testo dovrebbe essere grigio.</p>
          <div className="mt-4 flex space-x-2">
            <div className="w-10 h-10 bg-red-500 rounded"></div>
            <div className="w-10 h-10 bg-green-500 rounded"></div>
            <div className="w-10 h-10 bg-blue-500 rounded"></div>
          </div>
        </div>
        
        <div className="border border-gray-200 p-6 rounded-lg">
          <h2 className="text-xl font-medium mb-2">Test Bordi e Spaziature</h2>
          <div className="space-y-4">
            <div className="p-4 border border-blue-300 rounded">Padding 1rem, bordo blu</div>
            <div className="p-2 border-2 border-green-300 rounded">Padding 0.5rem, bordo verde</div>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-yellow-100 rounded-lg mb-4">
        <p className="text-yellow-800">
          Apri la console del browser con F12 per vedere i risultati della diagnostica.
        </p>
      </div>
      
      <p className="text-sm text-gray-500">
        Questo componente esegue una diagnosi per verificare se e come Tailwind CSS viene caricato nell'applicazione.
      </p>
    </div>
  )
}
