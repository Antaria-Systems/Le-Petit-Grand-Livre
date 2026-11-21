import { ImageResponse } from "next/og";
import { CarteOg } from "@/components/og/LogoOg";
import { site } from "@/lib/config";
import { db } from "@/lib/db";
import { formatEntier } from "@/lib/format";

export const alt = "Fiche commune : budget, travaux et documents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage d'une fiche : nom, département et quelques chiffres clés. */
export default async function ImageCommune({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const domaine = site.url.replace(/^https?:\/\//, "");
  const c = await db.commune.findUnique({
    where: { slug },
    select: {
      code: true,
      nom: true,
      population: true,
      departement: { select: { nom: true, code: true } },
      _count: { select: { documents: { where: { statut: "PUBLIE" } } } },
    },
  });
  if (!c) return new ImageResponse(<CarteOg site={site.nom} titre={site.nom} soustitre="Les finances des communes, en clair" pied={domaine} />, size);
  const dette = await db.agregatFinancier.findFirst({
    where: { communeCode: c.code, agregat: "Encours de dette", typeBudget: "Budget principal" },
    orderBy: { exercice: "desc" },
    select: { parHabitant: true, exercice: true },
  });
  const chiffres = [
    ...(c.population ? [{ valeur: formatEntier(c.population), libelle: "habitants" }] : []),
    ...(dette && dette.parHabitant !== null ? [{ valeur: `${formatEntier(dette.parHabitant)} €`, libelle: `de dette par habitant (${dette.exercice})` }] : []),
    ...(c._count.documents ? [{ valeur: formatEntier(c._count.documents), libelle: c._count.documents > 1 ? "documents publiés" : "document publié" }] : []),
  ];
  return new ImageResponse(
    <CarteOg site={site.nom} titre={c.nom} soustitre={`${c.departement.nom} (${c.departement.code}) · budget, travaux, documents`} pied={domaine} chiffres={chiffres} />,
    size,
  );
}
