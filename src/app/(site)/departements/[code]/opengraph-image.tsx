import { ImageResponse } from "next/og";
import { CarteOg } from "@/components/og/LogoOg";
import { site } from "@/lib/config";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";

export const alt = "Communes du département : budget, dette et documents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage d'un département : nombre de communes, habitants et documents publiés. */
export default async function ImageDepartement({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const domaine = site.url.replace(/^https?:\/\//, "");
  const d = await db.departement.findUnique({ where: { code }, select: { code: true, nom: true, actif: true } });
  if (!d) return new ImageResponse(<CarteOg site={site.nom} titre={site.nom} soustitre="Les finances des communes, en clair" pied={domaine} />, size);
  const [communes, documents] = d.actif
    ? await Promise.all([
        db.commune.aggregate({ where: { departementCode: code }, _count: true, _sum: { population: true } }),
        db.document.count({ where: { statut: "PUBLIE", commune: { departementCode: code } } }),
      ])
    : [null, 0];
  const chiffres = communes
    ? [
        { valeur: formatEntier(communes._count), libelle: "communes" },
        ...(communes._sum.population ? [{ valeur: formatEntier(communes._sum.population), libelle: "habitants" }] : []),
        ...(documents ? [{ valeur: formatEntier(documents), libelle: documents > 1 ? "documents publiés" : "document publié" }] : []),
      ]
    : [];
  return new ImageResponse(
    <CarteOg
      site={site.nom}
      titre={d.nom}
      soustitre={d.actif ? `Département (${d.code}) · budget, dette et documents des communes` : `Département (${d.code}) · bientôt couvert`}
      pied={domaine}
      chiffres={chiffres}
    />,
    size,
  );
}
