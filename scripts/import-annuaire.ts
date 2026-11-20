/**
 * Coordonnées des mairies (adresse électronique pour les demandes CRPA).
 * Source : Annuaire de l'administration, service-public.fr (Licence Ouverte).
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { departementsActifs } from "../src/lib/config";
import { getJson, odsExport } from "./http";

const ANNUAIRE = "https://api-lannuaire.service-public.fr";

type LigneAnnuaire = {
  code_insee_commune: string;
  adresse_courriel: string | null;
  telephone: string | null;
  adresse: string | null;
  site_internet: string | null;
};

function premier<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as T[];
    return v[0] ?? null;
  } catch {
    return null;
  }
}

function formaterAdresse(json: string | null): string | null {
  const a = premier<Record<string, string>>(json);
  if (!a) return null;
  const parties = [a.numero_voie, a.complement1, a.complement2, a.service_distribution, `${a.code_postal ?? ""} ${a.nom_commune ?? ""}`.trim()];
  return parties.filter((p) => p && p.trim()).join(", ") || null;
}

async function main() {
  for (const dep of departementsActifs()) {
    const lignes = await getJson<LigneAnnuaire[]>(
      odsExport(ANNUAIRE, "api-lannuaire-administration", {
        where: `startswith(code_insee_commune,'${dep}') and pivot like 'mairie'`,
        select: "code_insee_commune,adresse_courriel,telephone,adresse,site_internet",
      }),
    );
    let maj = 0;
    for (const l of lignes) {
      const res = await db.commune.updateMany({
        where: { code: l.code_insee_commune },
        data: {
          mairieEmail: l.adresse_courriel?.split(";")[0]?.trim() || null,
          mairieTelephone: premier<{ valeur: string }>(l.telephone)?.valeur ?? null,
          mairieAdresse: formaterAdresse(l.adresse),
          mairieSite: premier<{ valeur: string }>(l.site_internet)?.valeur ?? null,
        },
      });
      maj += res.count;
    }
    const sansEmail = await db.commune.count({ where: { departementCode: dep, mairieEmail: null } });
    console.log(`Département ${dep} : ${maj} mairies mises à jour, ${sansEmail} sans adresse électronique`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
