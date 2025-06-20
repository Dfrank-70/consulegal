import Script from 'next/script';

export default function DirectCSSTest() {
  return (
    <>
      <head>
        <link href="/tailwind-output.css" rel="stylesheet" />
      </head>
      <div className="min-h-screen p-8">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">
          Direct CSS Import Test
        </h1>
        <div className="bg-green-100 p-4 rounded-lg mb-4">
          <p className="text-green-800 font-medium">
            This page uses a direct CSS file imported from /public/tailwind-output.css
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-orange-100 p-4 rounded-lg">
            <p className="text-orange-800">Orange Box</p>
          </div>
          <div className="bg-purple-100 p-4 rounded-lg">
            <p className="text-purple-800">Purple Box</p>
          </div>
        </div>
        
        <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Test Button
        </button>
        
        <Script id="debug-script">
          {`
            console.log('Page loaded with direct CSS import');
            document.addEventListener('DOMContentLoaded', () => {
              console.log('DOM fully loaded');
            });
          `}
        </Script>
      </div>
    </>
  );
}
