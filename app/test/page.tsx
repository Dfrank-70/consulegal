'use client'

import '../../styles/tailwind-test.css'

export default function TestPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-blue-500 mb-4">Test Tailwind CSS</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="font-semibold text-xl mb-2">Card 1</h2>
          <p className="text-gray-600">Questo è un test per verificare che Tailwind CSS funzioni correttamente.</p>
          <button className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            Button
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="font-semibold text-xl mb-2 test-class">Card 2</h2>
          <p className="text-gray-600">Questo utilizza la classe .test-class definita nel CSS di test.</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h2 className="font-semibold text-xl mb-2">Card 3</h2>
          <div className="flex space-x-2">
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">Tag 1</span>
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Tag 2</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Tag 3</span>
          </div>
        </div>
      </div>
    </div>
  )
}
