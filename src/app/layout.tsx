import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import { scriptTheme } from "@/components/BoutonTheme";
import { site } from "@/lib/config";
import "./globals.css";

// Toutes les pages lisent la base : rendu à la requête.
export const dynamic = "force-dynamic";

// Linéale sobre et très lisible, libre (SIL OFL) : la police Marianne est réservée aux sites de l'État.
const police = Public_Sans({ subsets: ["latin"], variable: "--police", display: "swap" });

/** Codes de validation des outils pour webmestres (Google Search Console, Bing Webmaster Tools, Yandex). */
const verification = {
  google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  yandex: process.env.YANDEX_VERIFICATION || undefined,
  ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
};

export const metadata: Metadata = {
  title: { default: `${site.nom} · les finances de votre commune, en clair`, template: `%s · ${site.nom}` },
  description:
    "Budget, dette, impôts locaux, travaux et indemnités des élus de votre commune : les comptes publics et les documents obtenus auprès des mairies, rendus lisibles. Gratuit et indépendant.",
  metadataBase: new URL(site.url),
  applicationName: site.nom,
  ...(site.asso.nom ? { publisher: site.asso.nom, authors: [{ name: site.asso.nom, ...(site.asso.site ? { url: site.asso.site } : {}) }] } : {}),
  openGraph: { siteName: site.nom, locale: "fr_FR", type: "website" },
  twitter: { card: "summary_large_image" },
  verification,
};

// Couleur de la barre du navigateur mobile, et liseré des aperçus de lien sur Discord.
export const viewport: Viewport = { themeColor: "#1b3d8f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={police.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTheme }} />
        {/* Ajout du site comme moteur de recherche dans le navigateur (recherche de communes). */}
        <link rel="search" type="application/opensearchdescription+xml" title={site.nom} href="/opensearch.xml" />
      </head>
      <body>{children}</body>
    </html>
  );
}
