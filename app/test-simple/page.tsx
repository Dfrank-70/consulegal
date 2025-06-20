'use client'

export default function TestSimplePage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-blue-600">Test Semplice Tailwind</h1>
      <p className="mt-2 text-gray-600">Questo è un test semplice per Tailwind CSS.</p>
      <div className="mt-4 p-4 bg-blue-100 rounded-lg">
        <p>Questo box dovrebbe avere uno sfondo azzurro chiaro.</p>
      </div>
      <button 
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={() => alert('Tailwind funziona!')}
      >
        Cliccami
      </button>
    </div>
  )
}
