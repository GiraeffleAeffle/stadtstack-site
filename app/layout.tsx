import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://stadtstack.eu"),
  icons: { icon: "/favicon.svg" },
  title: "Stadtstack · Eine Stadt, viermal gesehen",
  description:
    "Derselbe Platz – gebaut, gemessen, beraten, verändert: ein interaktives Architekturmodell für Städte, die informiert handeln und voneinander lernen. Deutsch & English.",
  openGraph: {
    url: "https://stadtstack.eu",
    title: "Stadtstack · Eine Stadt, viermal gesehen",
    description:
      "Infrastruktur, Wissen, Entscheidungen und Umsetzung – und wie Ergebnisse zurück ins Stadtwissen fließen.",
    images: ["https://stadtstack.eu/stadtstack-overview.png"],
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stadtstack · One city, seen four ways",
    description:
      "The same square – built, measured, discussed, changed. An interactive architecture model for cities that learn.",
    images: ["https://stadtstack.eu/stadtstack-overview.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <head>
        <link
          rel="preload"
          href="/fonts/fraunces-normal-300-700-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/public-sans-normal-300-800-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
