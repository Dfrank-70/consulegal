"use client";

import { useEffect } from "react";

export default function TestPage() {
  // Add debug logging to verify client-side execution
  useEffect(() => {
    console.log("Test page mounted - client side JavaScript is working");
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">
        Tailwind CSS Test Page
      </h1>

      {/* Basic Tailwind classes test */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <div className="bg-green-100 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-green-800 mb-4">
            Green Container
          </h2>
          <p className="text-green-700">
            This test box should have green styling if Tailwind is working.
          </p>
        </div>

        <div className="bg-purple-100 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-purple-800 mb-4">
            Purple Container
          </h2>
          <p className="text-purple-700">
            This test box should have purple styling if Tailwind is working.
          </p>
        </div>
      </div>

      {/* Responsive design test */}
      <div className="mt-8 w-full max-w-3xl">
        <div className="bg-yellow-100 p-4 rounded-lg hidden sm:block">
          <p className="text-center text-yellow-800">
            This message should only be visible on SM screens and above
          </p>
        </div>
        <div className="bg-blue-100 p-4 rounded-lg mt-4 block md:hidden">
          <p className="text-center text-blue-800">
            This message should be hidden on MD screens and above
          </p>
        </div>
      </div>

      {/* Hover states test */}
      <button className="mt-8 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-800 transition-colors">
        Hover me (should change color)
      </button>

      {/* Browser console debug info */}
      <div className="mt-12 p-4 bg-gray-100 rounded-lg w-full max-w-3xl">
        <h3 className="font-medium mb-2">Debug Information:</h3>
        <p className="text-gray-700 text-sm">
          Check your browser console (F12) for JavaScript errors. If you see
          &quot;Test page mounted&quot; message, client-side JS is working.
        </p>
      </div>
    </div>
  );
}
