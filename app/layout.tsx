import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Unico file CSS con configurazioni Tailwind

import { SessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ConsulLegal AI - Consulenza Legale con Intelligenza Artificiale",
  description: "Ottieni consulenza legale istantanea grazie all'intelligenza artificiale avanzata.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ThemeProvider 
attribute="class" 
defaultTheme="system" 
enableSystem 
disableTransitionOnChange>
          <SessionProvider>
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
