export default function TestPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-blue-600 p-4">
        Tailwind CSS Test Page (Isolated)
      </h1>
      <div className="grid grid-cols-2 gap-4 p-4">
        <div className="bg-red-100 p-4 rounded">
          <p className="text-red-800">This should have red styling</p>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <p className="text-green-800">This should have green styling</p>
        </div>
      </div>
    </div>
  );
}
