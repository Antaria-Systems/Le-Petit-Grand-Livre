import { Entete } from "@/components/Entete";
import type { Metadata } from "next";
import { PageIntrouvable } from "@/components/PageIntrouvable";
import { Pied } from "@/components/Pied";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false, follow: true } };

/** Adresse inconnue (hors de toute section) : page 404 avec l'en-tête et le pied du site. */
export default function Introuvable() {
  return (
    <>
      <Entete />
      <main id="contenu">
        <PageIntrouvable />
      </main>
      <Pied />
    </>
  );
}
