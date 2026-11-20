"use server";

/**
 * Actions de l'administration. Chaque action revérifie la session : une action serveur est
 * joignable par une requête POST directe, pas seulement depuis l'interface.
 */
import { refresh } from "next/cache";
import { z } from "zod";
import type { StatutDemande } from "@/generated/prisma/enums";
import { adminCourant } from "@/lib/admin";
import { db } from "@/lib/db";
import { courrierDemande, delais, objetDemande, PIECES, type Piece } from "@/lib/demande";
import { envoyerDemandeMaintenant } from "@/lib/envoi-demande";
import { depuisHeureParis, formatDateHeure } from "@/lib/heure";
import { normaliser } from "@/lib/texte";

export type Etat = { ok?: string; erreur?: string } | null;

async function exigerAdmin() {
  if (!(await adminCourant())) throw new Error("Non autorisé");
}

const texte = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const entierOpt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .refine((v) => v === null || Number.isInteger(v), "Nombre entier attendu");
const montantOpt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace(/\s/g, "").replace(",", "."))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e10), "Montant invalide");
const dateOpt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00Z`)))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "Date invalide");

const champs = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const erreurDe = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" · ") : e instanceof Error ? e.message : String(e));

/* ───────────── Territoires ───────────── */

export async function activerDepartement(_e: Etat, f: FormData): Promise<Etat> {
  await exigerAdmin();
  const code = z.string().regex(/^[0-9AB]{2,3}$/).parse(f.get("code"));
  const enCours = await db.tache.findFirst({ where: { type: "IMPORTER_DEPARTEMENT", parametre: code, statut: { in: ["EN_ATTENTE", "EN_COURS"] } } });
  if (enCours) return { erreur: "Un import de ce département est déjà en cours." };
  await db.tache.create({ data: { type: "IMPORTER_DEPARTEMENT", parametre: code } });
  refresh();
  return { ok: "Import lancé : communes, carte, comptes OFGL et coordonnées des mairies (quelques minutes)." };
}

export async function desactiverDepartement(_e: Etat, f: FormData): Promise<Etat> {
  await exigerAdmin();
  const code = z.string().regex(/^[0-9AB]{2,3}$/).parse(f.get("code"));
  await db.departement.update({ where: { code }, data: { actif: false } });
  refresh();
  return { ok: "Département marqué comme non couvert (les données sont conservées)." };
}

/* ───────────── Commune ───────────── */

const schemaCommune = z.object({
  code: z.string().regex(/^[0-9AB]{5}$/),
  mairieAdresse: texte(300),
  mairieTelephone: texte(40),
  mairieEmail: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Adresse électronique invalide"),
  mairieSite: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || /^https?:\/\//.test(v), "L'adresse du site doit commencer par http(s)://"),
  presentation: texte(5000),
  notesInternes: texte(10000),
});

export async function modifierCommune(_e: Etat, f: FormData): Promise<Etat> {
  try {
    await exigerAdmin();
    const { code, ...data } = schemaCommune.parse(champs(f));
    await db.commune.update({ where: { code }, data });
    refresh();
    return { ok: "Fiche enregistrée." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

/* ───────────── Chantiers ───────────── */

const schemaChantier = z.object({
  id: entierOpt,
  communeCode: z.string().regex(/^[0-9AB]{5}$/),
  intitule: z.string().trim().min(3).max(200),
  categorie: texte(80),
  lieu: texte(300),
  description: texte(5000),
  prestataire: texte(300),
  statut: z.enum(["PREVUE", "EN_COURS", "REALISEE"]),
  annee: entierOpt,
  montantTTC: montantOpt,
  montantHT: montantOpt,
});

async function slugLibre(communeCode: string, intitule: string, sauf?: number) {
  const base = normaliser(intitule).replace(/ /g, "-").slice(0, 60) || "chantier";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const existe = await db.operation.findUnique({ where: { communeCode_slug: { communeCode, slug } }, select: { id: true } });
    if (!existe || existe.id === sauf) return slug;
  }
}

export async function enregistrerChantier(_e: Etat, f: FormData): Promise<Etat> {
  try {
    await exigerAdmin();
    const { id, communeCode, ...data } = schemaChantier.parse(champs(f));
    const documents = f.getAll("documents").map(String);
    const slug = await slugLibre(communeCode, data.intitule, id ?? undefined);
    const op = id
      ? await db.operation.update({ where: { id, communeCode }, data: { ...data, slug } })
      : await db.operation.create({ data: { ...data, communeCode, slug } });
    // Rattachement des documents cochés (uniquement ceux de la commune), détachement des autres.
    await db.$transaction([
      db.document.updateMany({ where: { operationId: op.id, id: { notIn: documents } }, data: { operationId: null } }),
      db.document.updateMany({ where: { communeCode, id: { in: documents } }, data: { operationId: op.id } }),
    ]);
    refresh();
    return { ok: id ? "Chantier enregistré." : "Chantier créé." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

export async function supprimerChantier(_e: Etat, f: FormData): Promise<Etat> {
  await exigerAdmin();
  const id = z.coerce.number().int().parse(f.get("id"));
  await db.operation.delete({ where: { id } }); // les documents sont conservés, simplement détachés
  refresh();
  return { ok: "Chantier supprimé ; ses documents sont conservés." };
}

/* ───────────── Élus : indemnités et frais ───────────── */

const schemaIndemnite = z.object({
  id: entierOpt,
  communeCode: z.string().regex(/^[0-9AB]{5}$/),
  annee: z.coerce.number().int().min(2000).max(2100),
  fonction: z.string().trim().min(2).max(120),
  ordre: z.coerce.number().int().min(0).max(999),
  montantBrutAnnuel: montantOpt.refine((v) => v !== null, "Montant obligatoire"),
  documentId: texte(40),
});

export async function enregistrerIndemnite(_e: Etat, f: FormData): Promise<Etat> {
  try {
    await exigerAdmin();
    const { id, communeCode, montantBrutAnnuel, ...data } = schemaIndemnite.parse(champs(f));
    const valeurs = { ...data, montantBrutAnnuel: montantBrutAnnuel! };
    if (id) await db.indemniteFonction.update({ where: { id, communeCode }, data: valeurs });
    else await db.indemniteFonction.create({ data: { ...valeurs, communeCode } });
    refresh();
    return { ok: "Indemnité enregistrée." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

export async function supprimerIndemnite(_e: Etat, f: FormData): Promise<Etat> {
  await exigerAdmin();
  await db.indemniteFonction.delete({ where: { id: z.coerce.number().int().parse(f.get("id")) } });
  refresh();
  return { ok: "Ligne supprimée." };
}

const schemaFrais = z.object({
  id: entierOpt,
  communeCode: z.string().regex(/^[0-9AB]{5}$/),
  annee: z.coerce.number().int().min(2000).max(2100),
  fonction: z.string().trim().min(2).max(120),
  nature: z.string().trim().min(2).max(120),
  libelle: texte(300),
  date: dateOpt,
  montant: montantOpt.refine((v) => v !== null, "Montant obligatoire"),
  documentId: texte(40),
});

export async function enregistrerFrais(_e: Etat, f: FormData): Promise<Etat> {
  try {
    await exigerAdmin();
    const { id, communeCode, montant, ...data } = schemaFrais.parse(champs(f));
    const valeurs = { ...data, montant: montant! };
    if (id) await db.fraisFonction.update({ where: { id, communeCode }, data: valeurs });
    else await db.fraisFonction.create({ data: { ...valeurs, communeCode } });
    refresh();
    return { ok: "Frais enregistrés." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

export async function supprimerFrais(_e: Etat, f: FormData): Promise<Etat> {
  await exigerAdmin();
  await db.fraisFonction.delete({ where: { id: z.coerce.number().int().parse(f.get("id")) } });
  refresh();
  return { ok: "Ligne supprimée." };
}

/* ───────────── Demandes CRPA / CADA ───────────── */

export async function creerDemande(_e: Etat, f: FormData): Promise<Etat> {
  try {
    await exigerAdmin();
    const communeCode = z.string().regex(/^[0-9AB]{5}$/).parse(f.get("communeCode"));
    const annee = z.coerce.number().int().min(2000).max(2100).parse(f.get("annee"));
    const exercice = z.coerce.number().int().min(2000).max(2100).parse(f.get("exercice"));
    const pieces = f.getAll("pieces").map(String).filter((p): p is Piece => p in PIECES);
    if (pieces.length === 0) return { erreur: "Cochez au moins une pièce à demander." };
    const commune = await db.commune.findUniqueOrThrow({ where: { code: communeCode }, select: { nom: true, mairieEmail: true } });
    const existe = await db.demande.findUnique({ where: { communeCode_annee: { communeCode, annee } }, select: { id: true } });
    if (existe) return { erreur: `Une demande existe déjà pour ${annee} (une seule demande groupée par commune et par an).` };
    await db.demande.create({
      data: {
        communeCode,
        annee,
        objet: objetDemande(commune.nom, exercice),
        corps: courrierDemande(commune.nom, exercice, pieces),
        destinataire: commune.mairieEmail ?? "",
        statut: "BROUILLON",
      },
    });
    refresh();
    return { ok: "Brouillon créé : relisez le courrier avant de l'envoyer." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

const STATUTS = ["BROUILLON", "ENVOYEE", "RELANCEE", "REFUS_IMPLICITE", "REFUS_EXPRES", "CADA_SAISIE", "REPONSE_PARTIELLE", "SATISFAITE", "ABANDONNEE"] as const;

const schemaDemande = z.object({
  id: z.string().min(1).max(40),
  objet: z.string().trim().min(5).max(300),
  corps: z.string().trim().min(20).max(20000),
  destinataire: z.string().trim().max(200),
  statut: z.enum(STATUTS),
  envoyeeLe: dateOpt,
  relanceeLe: dateOpt,
  reponseLe: dateOpt,
  cadaSaisieLe: dateOpt,
  numeroCada: texte(60),
  avisCadaLe: dateOpt,
  avisCada: texte(200),
  clotureLe: dateOpt,
  notes: texte(10000),
});

export async function modifierDemande(_e: Etat, f: FormData): Promise<Etat> {
  try {
    await exigerAdmin();
    const { id, ...data } = schemaDemande.parse(champs(f));
    const { echeanceReponse, limiteSaisineCada } = delais(data.envoyeeLe, data.statut === "REFUS_EXPRES" ? data.reponseLe : null);
    await db.demande.update({ where: { id }, data: { ...data, statut: data.statut as StatutDemande, echeanceReponse, limiteSaisineCada } });
    refresh();
    return { ok: "Demande enregistrée." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

export async function supprimerDemande(_e: Etat, f: FormData): Promise<Etat> {
  // (une demande programmée reste un brouillon : la supprimer annule aussi son envoi)
  await exigerAdmin();
  const id = z.string().min(1).parse(f.get("id"));
  const d = await db.demande.findUniqueOrThrow({ where: { id }, select: { statut: true } });
  if (d.statut !== "BROUILLON") return { erreur: "Seul un brouillon peut être supprimé ; une demande envoyée peut être marquée « abandonnée »." };
  await db.demande.delete({ where: { id } });
  refresh();
  return { ok: "Brouillon supprimé." };
}

/**
 * Envoi de la demande par le relais SMTP, immédiatement ou à une date et heure choisies (heure de
 * Paris) — dans les deux cas uniquement sur confirmation explicite.
 */
export async function envoyerDemande(_e: Etat, f: FormData): Promise<Etat> {
  try {
    await exigerAdmin();
    if (f.get("confirmation") !== "oui") return { erreur: "Cochez la case de confirmation." };
    const id = z.string().min(1).parse(f.get("id"));
    const copie = f.get("copie") === "oui";
    const d = await db.demande.findUniqueOrThrow({ where: { id }, select: { statut: true, destinataire: true } });
    if (d.statut !== "BROUILLON") return { erreur: "Cette demande a déjà été envoyée." };
    if (!z.string().email().safeParse(d.destinataire).success) return { erreur: "Adresse du destinataire invalide : corrigez-la dans « Courrier, statut et dates »." };

    if (f.get("mode") === "programmer") {
      const quand = depuisHeureParis(String(f.get("quand") ?? ""));
      if (!quand) return { erreur: "Indiquez la date et l'heure d'envoi." };
      if (quand.getTime() < Date.now() + 60_000) return { erreur: "L'heure d'envoi doit être dans le futur." };
      if (quand.getTime() > Date.now() + 366 * 86_400_000) return { erreur: "L'envoi ne peut pas être programmé à plus d'un an." };
      await db.demande.update({ where: { id }, data: { envoiProgrammeLe: quand, envoiCopieCachee: copie, erreurEnvoi: null } });
      refresh();
      return { ok: `Envoi programmé le ${formatDateHeure(quand)} (heure de Paris).` };
    }

    const r = await envoyerDemandeMaintenant(id, copie);
    refresh();
    return { ok: `Demande envoyée à ${r.destinataire}. Réponse attendue avant le ${r.echeanceReponse!.toLocaleDateString("fr-FR")}.` };
  } catch (e) {
    return { erreur: `Envoi impossible : ${erreurDe(e)}` };
  }
}

export async function annulerEnvoiProgramme(_e: Etat, f: FormData): Promise<Etat> {
  await exigerAdmin();
  const id = z.string().min(1).parse(f.get("id"));
  const r = await db.demande.updateMany({ where: { id, statut: "BROUILLON" }, data: { envoiProgrammeLe: null } });
  refresh();
  return r.count ? { ok: "Envoi programmé annulé : la demande reste en brouillon." } : { erreur: "La demande a déjà été envoyée." };
}

const schemaMessage = z.object({
  demandeId: z.string().min(1).max(40),
  sens: z.enum(["ENTRANT", "SORTANT"]),
  date: dateOpt.refine((v) => v !== null, "Date obligatoire"),
  de: z.string().trim().min(1).max(200),
  a: z.string().trim().min(1).max(200),
  sujet: z.string().trim().min(1).max(300),
  corps: z.string().trim().max(20000),
});

/** Échange consigné à la main (réponse de la mairie, relance, courrier de la CADA…). */
export async function ajouterMessage(_e: Etat, f: FormData): Promise<Etat> {
  try {
    await exigerAdmin();
    const { date, ...data } = schemaMessage.parse(champs(f));
    await db.message.create({ data: { ...data, date: date! } });
    refresh();
    return { ok: "Échange ajouté au journal." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

export async function rattacherDocumentsDemande(_e: Etat, f: FormData): Promise<Etat> {
  await exigerAdmin();
  const id = z.string().min(1).parse(f.get("id"));
  const d = await db.demande.findUniqueOrThrow({ where: { id }, select: { communeCode: true } });
  const documents = f.getAll("documents").map(String);
  await db.$transaction([
    db.document.updateMany({ where: { demandeId: id, id: { notIn: documents } }, data: { demandeId: null } }),
    db.document.updateMany({ where: { communeCode: d.communeCode, id: { in: documents } }, data: { demandeId: id } }),
  ]);
  refresh();
  return { ok: `${documents.length} document(s) rattaché(s) à la demande.` };
}
