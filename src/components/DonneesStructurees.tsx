import { jsonLd } from "@/lib/seo";

/** Données structurées schema.org (JSON-LD), lues par les moteurs de recherche ; rien d'affiché. */
export function DonneesStructurees({ donnees }: { donnees: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(donnees) }} />;
}
