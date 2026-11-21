import type { MetadataRoute } from "next";
import { site } from "@/lib/config";
import { db } from "@/lib/db";

// Lu en base à la demande (jamais au moment de la construction de l'image).
export const dynamic = "force-dynamic";

/** Plan du site : pages fixes, territoires couverts et fiches des communes des départements couverts. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [departements, communes, publications] = await Promise.all([
    db.departement.findMany({ where: { actif: true }, select: { code: true, regionCode: true } }),
    db.commune.findMany({ where: { departement: { actif: true } }, select: { slug: true, code: true, majLe: true } }),
    db.document.groupBy({ by: ["communeCode"], where: { statut: "PUBLIE" }, _max: { publieLe: true } }),
  ]);
  const publie = new Map(publications.map((p) => [p.communeCode, p._max.publieLe]));
  const url = (chemin: string) => `${site.url}${chemin}`;
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/regions"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/methodologie"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/a-propos"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/mentions-legales"), changeFrequency: "yearly", priority: 0.1 },
    ...[...new Set(departements.map((d) => d.regionCode))].map((r) => ({ url: url(`/regions/${r}`), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...departements.map((d) => ({ url: url(`/departements/${d.code}`), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...communes.map((c) => {
      const p = publie.get(c.code);
      return {
        url: url(`/communes/${c.slug}`),
        lastModified: p && p > c.majLe ? p : c.majLe,
        changeFrequency: "monthly" as const,
        priority: p ? 0.9 : 0.6,
      };
    }),
  ];
}
