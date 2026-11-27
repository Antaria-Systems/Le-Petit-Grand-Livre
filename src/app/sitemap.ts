import type { MetadataRoute } from "next";
import { pagesDuSite } from "@/lib/plan-du-site";
import { urlAbsolue } from "@/lib/seo";

// Lu en base à la demande (jamais au moment de la construction de l'image).
export const dynamic = "force-dynamic";

/** Plan du site : pages fixes, territoires couverts et fiches des communes des départements couverts. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return (await pagesDuSite()).map((p) => ({
    url: urlAbsolue(p.chemin),
    ...(p.modifieLe ? { lastModified: p.modifieLe } : {}),
    changeFrequency: p.frequence,
    priority: p.priorite,
  }));
}
