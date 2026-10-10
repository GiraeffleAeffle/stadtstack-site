import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://stadtstack.eu"),
  icons: { icon: "/favicon.svg" },
  title: "Stadtstack · Stadt gemeinsam ausprobieren",
  description:
    "Ledger of Life, ZK Loyalty, Spiel, Beteiligung, Offline-Mesh und offene Stadtdaten: aktuelle Projekte, Pilotstatus und klare Grenzen.",
  openGraph: {
    url: "https://stadtstack.eu",
    title: "Stadtstack · Stadt gemeinsam ausprobieren",
    description:
      "Ein unabhängiges Stadtlabor für Wohnen, lokale Läden, Beteiligung und offene Daten. Kein offizieller Stadtdienst.",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Stadtstack · Stadt gemeinsam ausprobieren",
    description:
      "Aktuelle Projekte und ihre Grenzen: Testnetze, beratende Beteiligung und ein Offline-Mesh im Labor.",
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
