/** Tests sans base de données : descriptions des fiches, données structurées, soumissions IndexNow. */
import assert from "node:assert/strict";
import { test } from "node:test";

// Lu au chargement des modules : à définir avant de les importer. La base n'est jamais contactée.
process.env.SITE_URL = "https://exemple.fr";
process.env.SITE_NAME = "Le Petit Grand Livre";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:1/test";
process.env.INDEXNOW_KEY = "0123456789abcdef0123456789abcdef";

const { descriptionCommune, filAriane, jsonLd, urlAbsolue } = await import("../src/lib/seo");
const { cleIndexNow, soumettreIndexNow } = await import("../src/lib/indexnow");

test("description d'une fiche : chiffres de la commune en tête", () => {
  const d = descriptionCommune({
    nom: "Lavalette",
    departement: "Aude",
    codePostal: "11290",
    population: 1612,
    annee: 2025,
    depenses: 1_934_000,
    detteParHabitant: 431,
    nbDocuments: 91,
  });
  assert.equal(
    d,
    "Lavalette (11290, Aude), 1 612 habitants : 1,9 M€ de dépenses et 431 € de dette par habitant en 2025. Budget, impôts locaux, travaux, indemnités des élus et 91 documents de la mairie.",
  );
});

test("description d'une fiche sans comptes ni documents", () => {
  const d = descriptionCommune({ nom: "Bugarach", departement: "Aude", population: null, nbDocuments: 0 });
  assert.equal(d, "Bugarach (Aude). Budget, impôts locaux, travaux, indemnités des élus et documents de la mairie.");
});

test("JSON-LD : aucun texte ne peut fermer la balise script", () => {
  const s = jsonLd({ name: "</script><script>alert(1)</script>" });
  assert.ok(!s.includes("<"));
  assert.deepEqual(JSON.parse(s), { name: "</script><script>alert(1)</script>" });
});

test("fil d'Ariane : adresses absolues, dernière étape sans lien", () => {
  const f = filAriane([{ libelle: "Accueil", href: "/" }, { libelle: "Aude", href: "/departements/11" }, { libelle: "Lavalette" }]) as {
    itemListElement: { position: number; name: string; item?: string }[];
  };
  assert.deepEqual(f.itemListElement, [
    { "@type": "ListItem", position: 1, name: "Accueil", item: "https://exemple.fr/" },
    { "@type": "ListItem", position: 2, name: "Aude", item: "https://exemple.fr/departements/11" },
    { "@type": "ListItem", position: 3, name: "Lavalette" },
  ]);
  // Une étape intermédiaire sans lien rendrait le balisage invalide : rien n'est produit.
  assert.equal(filAriane([{ libelle: "Accueil", href: "/" }, { libelle: "Territoires" }, { libelle: "Aude" }]), null);
});

test("IndexNow : clé hexadécimale de 32 caractères, sinon désactivé", () => {
  assert.equal(cleIndexNow(), "0123456789abcdef0123456789abcdef");
  const avant = process.env.INDEXNOW_KEY;
  process.env.INDEXNOW_KEY = "trop-courte";
  assert.equal(cleIndexNow(), null);
  process.env.INDEXNOW_KEY = avant;
});

test("IndexNow : lots de 10 000 adresses, hôte et emplacement de la clé", async () => {
  const appels: { host: string; key: string; keyLocation: string; urlList: string[] }[] = [];
  const faux = (async (_url: string, init: RequestInit) => {
    appels.push(JSON.parse(String(init.body)));
    return new Response(null, { status: 202 });
  }) as typeof fetch;
  const urls = Array.from({ length: 10_001 }, (_, i) => urlAbsolue(`/communes/c-${i}`));
  await soumettreIndexNow(urls, faux);
  assert.equal(appels.length, 2);
  assert.equal(appels[0].urlList.length, 10_000);
  assert.equal(appels[1].urlList.length, 1);
  assert.equal(appels[0].host, "exemple.fr");
  assert.equal(appels[0].keyLocation, "https://exemple.fr/0123456789abcdef0123456789abcdef.txt");
});

test("IndexNow : un refus remonte en erreur (la date du dernier signalement n'avance pas)", async () => {
  const faux = (async () => new Response(null, { status: 403, statusText: "Forbidden" })) as unknown as typeof fetch;
  await assert.rejects(soumettreIndexNow([urlAbsolue("/")], faux), /403/);
});
