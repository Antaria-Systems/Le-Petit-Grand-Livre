/**
 * Référentiel géographique : régions, départements (tous) et communes des
 * départements actifs. Source : API Découpage administratif (geo.api.gouv.fr).
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { departementsActifs } from "../src/lib/config";
import { normaliser, slugCommune } from "../src/lib/texte";
import { getJson } from "./http";

const GEO = "https://geo.api.gouv.fr";

type GeoRegion = { code: string; nom: string };
type GeoDepartement = { code: string; nom: string; codeRegion: string };
type GeoCommune = { code: string; nom: string; population?: number; codesPostaux: string[]; siren?: string };

async function main() {
  const actifs = departementsActifs();
  const regions = await getJson<GeoRegion[]>(`${GEO}/regions`);
  const departements = await getJson<GeoDepartement[]>(`${GEO}/departements`);

  for (const r of regions) {
    await db.region.upsert({ where: { code: r.code }, create: r, update: { nom: r.nom } });
  }
  for (const d of departements) {
    const data = { nom: d.nom, regionCode: d.codeRegion, actif: actifs.includes(d.code) };
    await db.departement.upsert({ where: { code: d.code }, create: { code: d.code, ...data }, update: data });
  }
  console.log(`${regions.length} régions, ${departements.length} départements`);

  for (const dep of actifs) {
    const communes = await getJson<GeoCommune[]>(
      `${GEO}/departements/${dep}/communes?fields=nom,code,population,codesPostaux,siren`,
    );
    await db.$transaction(
      communes.map((c) => {
        const data = {
          nom: c.nom,
          nomRecherche: normaliser(c.nom),
          slug: slugCommune(c.nom, c.code),
          departementCode: dep,
          population: c.population ?? null,
          codesPostaux: c.codesPostaux,
          siren: c.siren ?? null,
        };
        return db.commune.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data });
      }),
    );
    console.log(`Département ${dep} : ${communes.length} communes`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
