import "../../styles/minimal.css";

export default function MinimalTest() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold text-blue-600 mb-6">
        Minimal Tailwind Test
      </h1>
      <div className="bg-yellow-100 p-4 rounded-lg mb-4">
        <p className="text-yellow-800">This is a minimal Tailwind test with direct CSS import</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-pink-100 p-4 rounded-lg">
          <p className="text-pink-800">Pink Box</p>
        </div>
        <div className="bg-indigo-100 p-4 rounded-lg">
          <p className="text-indigo-800">Indigo Box</p>
        </div>
      </div>
      
      <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Test Button
      </button>
      
      <p className="mt-6 text-gray-500">
        If you see styles applied, Tailwind is working correctly.
      </p>
    </div>
  );
}
