/**
 * Tests d'envoi des demandes (base de test obligatoire : TEST_DATABASE_URL), avec un transport
 * factice : AUCUN courriel n'est envoyé.
 *   TEST_DATABASE_URL=postgresql://… npm test
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.SMTP_FROM ??= "test@example.com";

const { db } = await import("../src/lib/db");
const { envoyerDemandeMaintenant, traiterEnvoisProgrammes } = await import("../src/lib/envoi-demande");

type Faux = { appels: number; sendMail: (m: unknown) => Promise<{ messageId: string }> };
function transportLent(ms = 300): Faux {
  const t: Faux = {
    appels: 0,
    sendMail: async () => {
      t.appels++;
      await new Promise((r) => setTimeout(r, ms));
      return { messageId: `<test-${Date.now()}-${t.appels}@example.com>` };
    },
  };
  return t;
}

const CODE = "11199"; // Lavalette
let id = "";
const ANNEE = 2999;

before(async () => {
  if (!url) return;
  await db.demande.deleteMany({ where: { annee: ANNEE } });
  const d = await db.demande.create({
    data: { communeCode: CODE, annee: ANNEE, objet: "TEST objet", corps: "TEST corps ".repeat(5), destinataire: "mairie@example.com", statut: "BROUILLON" },
  });
  id = d.id;
});

after(async () => {
  if (!url) return;
  await db.demande.deleteMany({ where: { annee: ANNEE } });
  await db.$disconnect();
});

test("deux envois immédiats simultanés : un seul courriel", { skip: !url }, async () => {
  const t = transportLent();
  const r = await Promise.allSettled([
    envoyerDemandeMaintenant(id, false, t as never),
    envoyerDemandeMaintenant(id, false, t as never),
  ]);
  assert.equal(t.appels, 1);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  const d = await db.demande.findUniqueOrThrow({ where: { id }, include: { messages: true } });
  assert.equal(d.statut, "ENVOYEE");
  assert.equal(d.envoiEnCoursLe, null);
  assert.equal(d.messages.length, 1);
});

test("envoi programmé + envoi immédiat + trois workers : un seul courriel", { skip: !url }, async () => {
  await db.message.deleteMany({ where: { demandeId: id } });
  await db.demande.update({
    where: { id },
    data: { statut: "BROUILLON", envoyeeLe: null, echeanceReponse: null, limiteSaisineCada: null, envoiProgrammeLe: new Date(Date.now() - 1000) },
  });
  const t = transportLent();
  await Promise.allSettled([
    traiterEnvoisProgrammes(() => {}, t as never),
    traiterEnvoisProgrammes(() => {}, t as never),
    traiterEnvoisProgrammes(() => {}, t as never),
    envoyerDemandeMaintenant(id, false, t as never),
  ]);
  assert.equal(t.appels, 1);
  const d = await db.demande.findUniqueOrThrow({ where: { id } });
  assert.equal(d.statut, "ENVOYEE");
  assert.equal(d.erreurEnvoi, null);
});

test("refus certain du relais : rien n'est parti, la demande redevient envoyable", { skip: !url }, async () => {
  await db.message.deleteMany({ where: { demandeId: id } });
  await db.demande.update({ where: { id }, data: { statut: "BROUILLON", envoyeeLe: null, envoiProgrammeLe: null } });
  const refus = { sendMail: async () => Promise.reject(Object.assign(new Error("Relay access denied"), { code: "EENVELOPE", responseCode: 550, command: "RCPT TO" })) };
  await assert.rejects(envoyerDemandeMaintenant(id, false, refus as never));
  const d = await db.demande.findUniqueOrThrow({ where: { id } });
  assert.equal(d.statut, "BROUILLON");
  assert.equal(d.envoiEnCoursLe, null);
});

test("coupure pendant la transmission : réservation conservée, état incertain signalé", { skip: !url }, async () => {
  const coupure = { sendMail: async () => Promise.reject(Object.assign(new Error("Connection closed"), { code: "ECONNECTION", command: "DATA" })) };
  await assert.rejects(envoyerDemandeMaintenant(id, false, coupure as never));
  const d = await db.demande.findUniqueOrThrow({ where: { id } });
  assert.equal(d.statut, "BROUILLON");
  assert.notEqual(d.envoiEnCoursLe, null);
  assert.match(d.erreurEnvoi ?? "", /INCERTAIN/);
  // Un nouvel envoi est refusé tant que l'administrateur n'a pas vérifié.
  const t = transportLent(10);
  await assert.rejects(envoyerDemandeMaintenant(id, false, t as never));
  assert.equal(t.appels, 0);
});

test("envoi programmé avec plus de 6 h de retard : annulé et signalé, rien n'est parti", { skip: !url }, async () => {
  await db.demande.update({ where: { id }, data: { envoiEnCoursLe: null, erreurEnvoi: null, envoiProgrammeLe: new Date(Date.now() - 7 * 3600_000) } });
  const t = transportLent(10);
  await traiterEnvoisProgrammes(() => {}, t as never);
  assert.equal(t.appels, 0);
  const d = await db.demande.findUniqueOrThrow({ where: { id } });
  assert.equal(d.envoiProgrammeLe, null);
  assert.match(d.erreurEnvoi ?? "", /retard/);
});
