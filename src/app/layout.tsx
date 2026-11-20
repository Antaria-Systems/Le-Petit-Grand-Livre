import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Entete } from "@/components/Entete";
import { Pied } from "@/components/Pied";
import { scriptTheme } from "@/components/BoutonTheme";
import { site } from "@/lib/config";
import "./globals.css";

// Toutes les pages lisent la base : rendu à la requête.
export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${site.nom} · les finances de votre commune, en clair`, template: `%s · ${site.nom}` },
  description:
    "Budgets, indemnités des élus, travaux : les documents publics des communes, obtenus au titre du droit d'accès aux documents administratifs (CRPA) et rendus lisibles.",
  metadataBase: new URL(site.url),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTheme }} />
      </head>
      <body>
        <Entete />
        <main id="contenu">{children}</main>
        <Pied />
      </body>
    </html>
  );
}
