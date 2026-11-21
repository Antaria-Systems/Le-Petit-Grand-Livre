/** Tests sans base de données : délais légaux, montants saisis, clés RIB / NIR / IBAN. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ajouterMois, delais, formatJourParis, jourParis } from "../src/lib/demande";
import { lireMontant } from "../src/lib/montant";
import { ibanValide, masquer, nirValide, ribValide } from "../src/lib/traitement/detection";

const paris = (iso: string) => new Date(iso); // instants explicites (Z)

test("délai d'un mois : règle du quantième, dernier jour du mois à défaut", () => {
  assert.equal(formatJourParis(ajouterMois(paris("2027-01-31T10:00:00Z"), 1)), "28/02/2027");
  assert.equal(formatJourParis(ajouterMois(paris("2028-01-31T10:00:00Z"), 1)), "29/02/2028");
  assert.equal(formatJourParis(ajouterMois(paris("2027-03-31T10:00:00Z"), 1)), "30/04/2027");
  assert.equal(formatJourParis(ajouterMois(paris("2026-08-31T10:00:00Z"), 1)), "30/09/2026");
  assert.equal(formatJourParis(ajouterMois(paris("2026-11-23T06:00:00Z"), 1)), "23/12/2026");
});

test("délais calculés sur la date de Paris (envoi à 00:30 heure de Paris)", () => {
  // 31/01/2027 00:30 à Paris = 30/01/2027 23:30 UTC
  const envoi = paris("2027-01-30T23:30:00Z");
  assert.deepEqual(jourParis(envoi), [2027, 1, 31]);
  const { echeanceReponse, limiteSaisineCada } = delais(envoi);
  assert.equal(formatJourParis(echeanceReponse!), "28/02/2027");
  assert.equal(formatJourParis(limiteSaisineCada!), "28/04/2027");
});

test("échéance en fin de journée, heure de Paris (été comme hiver)", () => {
  const hiver = ajouterMois(paris("2026-11-23T06:00:00Z"), 1);
  assert.equal(hiver.toISOString(), "2026-12-23T22:59:59.000Z");
  const ete = ajouterMois(paris("2027-06-15T06:00:00Z"), 1);
  assert.equal(ete.toISOString(), "2027-07-15T21:59:59.000Z");
});

test("montants saisis dans les formats courants", () => {
  assert.equal(lireMontant("1234,56"), 1234.56);
  assert.equal(lireMontant("1 234,56 €"), 1234.56);
  assert.equal(lireMontant("1.234,56"), 1234.56);
  assert.equal(lireMontant("2 640,00€"), 2640);
  assert.equal(lireMontant("1234.56"), 1234.56);
  assert.equal(lireMontant("1,234.56"), 1234.56);
  assert.equal(lireMontant("12.345.678"), 12345678);
  assert.equal(lireMontant("1 234,5"), 1234.5);
  assert.ok(Number.isNaN(lireMontant("environ 300")));
  assert.ok(Number.isNaN(lireMontant("1.234.56")));
});

test("clés de contrôle", () => {
  assert.ok(ibanValide("FR76 3000 6000 0112 3456 7890 189"));
  assert.ok(!ibanValide("FR76 3000 6000 0112 3456 7890 188"));
  assert.ok(ribValide("30006 00001 12345678901 89"));
  assert.ok(!ribValide("30006 00001 12345678901 88"));
  assert.ok(nirValide("1 85 05 78 006 084 91"));
  assert.ok(!nirValide("1 85 05 78 006 084 36"));
  assert.ok(nirValide("2 69 05 2A 004 001 39"));
});

test("valeurs masquées dans les messages", () => {
  assert.equal(masquer("jean.dupont@example.net"), "je***@example.net");
  assert.equal(masquer("FR76 3000 6000 0112 3456 7890 189"), "FR76***89");
});
