import type { Metadata } from "next";
import { PageIntrouvable } from "@/components/PageIntrouvable";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false, follow: true } };

/** Commune, département ou région inexistants : page 404 dans la mise en page du site. */
export default function Introuvable() {
  return <PageIntrouvable />;
}
