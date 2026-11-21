import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import { scriptTheme } from "@/components/BoutonTheme";
import { site } from "@/lib/config";
import "./globals.css";

// Toutes les pages lisent la base : rendu à la requête.
export const dynamic = "force-dynamic";

// Linéale sobre et très lisible, libre (SIL OFL) : la police Marianne est réservée aux sites de l'État.
const police = Public_Sans({ subsets: ["latin"], variable: "--police", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${site.nom} · les finances de votre commune, en clair`, template: `%s · ${site.nom}` },
  description:
    "Budgets, indemnités des élus, travaux : les documents publics des communes, obtenus au titre du droit d'accès aux documents administratifs (CRPA) et rendus lisibles.",
  metadataBase: new URL(site.url),
  openGraph: { siteName: site.nom, locale: "fr_FR", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={police.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
