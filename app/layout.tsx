import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Unico file CSS con configurazioni Tailwind

import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Traspolegal - Consulenza Legale con Intelligenza Artificiale",
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
