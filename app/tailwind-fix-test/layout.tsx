import "../../app/globals.css";

export default function TestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <head>
        <title>Tailwind Test</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}
