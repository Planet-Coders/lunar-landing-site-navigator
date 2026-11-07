import type { Metadata } from "next";
import { IBM_Plex_Mono, Orbitron } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"],
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "LuminaLuna · Lunar Landing Site & Communication Evaluator",
  description:
    "Evaluate lunar south pole landing sites for solar power and Earth line-of-sight using NASA JPL Horizons ephemerides.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${orbitron.variable} ${plex.variable}`}>
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
