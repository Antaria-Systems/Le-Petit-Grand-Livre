/**
 * Applique un fichier de données relevées (chantiers + informations par document) à une commune.
 *   npx tsx scripts/appliquer-donnees.ts donnees/11199-lavalette.json [--confirmer]
 * Idempotent : les chantiers sont mis à jour par leur identifiant (slug).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CATEGORIES } from "../src/lib/admin-schemas";
import { db } from "../src/lib/db";

const montant = z.number().nonnegative().optional();
const schema = z.object({
  commune: z.string(),
  chantiers: z.array(
    z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      intitule: z.string(),
      categorie: z.string().optional(),
      lieu: z.string().optional(),
      description: z.string().optional(),
      prestataire: z.string().optional(),
      statut: z.enum(["PREVUE", "EN_COURS", "REALISEE"]),
      annee: z.number().int().optional(),
      ttc: montant,
      ht: montant,
    }),
  ),
  documents: z.record(
    z.string(),
    z.object({
      titre: z.string().max(200),
      categorie: z.enum(CATEGORIES).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      annee: z.number().int().optional(),
      entreprise: z.string().optional(),
      objet: z.string().optional(),
      ttc: montant,
      ht: montant,
      copie: z.boolean().optional(),
      chantier: z.string().optional(),
    }),
  ),
});

async function main() {
  const fichier = process.argv[2];
  if (!fichier) throw new Error("Usage : appliquer-donnees.ts <fichier.json> [--confirmer]");
  const d = schema.parse(JSON.parse(await readFile(fichier, "utf8")));
  const confirmer = process.argv.includes("--confirmer");

  const existants = await db.document.findMany({ where: { communeCode: d.commune }, select: { id: true, statut: true } });
  const ids = new Set(existants.map((e) => e.id));
  const inconnus = Object.keys(d.documents).filter((id) => !ids.has(id));
  const oublies = existants.filter((e) => e.statut === "PUBLIE" && !d.documents[e.id]).map((e) => e.id);
  const slugs = new Set(d.chantiers.map((c) => c.slug));
  const chantiersInconnus = Object.values(d.documents).filter((x) => x.chantier && !slugs.has(x.chantier)).map((x) => x.chantier);
  if (inconnus.length || chantiersInconnus.length) throw new Error(`Incohérences : documents inconnus ${inconnus.join(", ")} ; chantiers inconnus ${chantiersInconnus.join(", ")}`);
  console.log(`${d.chantiers.length} chantiers, ${Object.keys(d.documents).length} documents relevés, ${oublies.length} document(s) publié(s) non relevé(s)`);
  if (!confirmer) return console.log("(simulation : ajoutez --confirmer)");

  const idChantier = new Map<string, number>();
  for (const c of d.chantiers) {
    const data = {
      intitule: c.intitule,
      categorie: c.categorie ?? null,
      lieu: c.lieu ?? null,
      description: c.description ?? null,
      prestataire: c.prestataire ?? null,
      statut: c.statut,
      annee: c.annee ?? null,
      montantTTC: c.ttc ?? null,
      montantHT: c.ht ?? null,
    };
    const op = await db.operation.upsert({
      where: { communeCode_slug: { communeCode: d.commune, slug: c.slug } },
      create: { communeCode: d.commune, slug: c.slug, ...data },
      update: data,
    });
    idChantier.set(c.slug, op.id);
  }
  for (const [id, x] of Object.entries(d.documents)) {
    await db.document.update({
      where: { id },
      data: {
        titre: x.titre,
        ...(x.categorie ? { categorie: x.categorie } : {}),
        dateDocument: x.date ? new Date(`${x.date}T00:00:00Z`) : null,
        annee: x.date ? Number(x.date.slice(0, 4)) : (x.annee ?? null),
        entreprise: x.entreprise ?? null,
        objet: x.objet ?? null,
        montantTTC: x.ttc ?? null,
        montantHT: x.ht ?? null,
        copie: x.copie ?? false,
        operationId: x.chantier ? idChantier.get(x.chantier)! : null,
      },
    });
  }
  console.log("Appliqué.");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
