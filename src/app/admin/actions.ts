"use server";

/**
 * Actions de l'administration. Chaque action revérifie la session : une action serveur est
 * joignable par une requête POST directe, pas seulement depuis l'interface.
 */
import { refresh } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { StatutDemande } from "@/generated/prisma/enums";
import { adminCourant } from "@/lib/admin";
import { db } from "@/lib/db";
import { courrierDemande, delais, formatJourParis, jourParis, objetDemande, PIECES, piecesParDefaut, type Piece } from "@/lib/demande";
import { EnvoiDejaEnCours, EnvoiIncertain, envoyerDemandeMaintenant, messageErreurEnvoi } from "@/lib/envoi-demande";
import { depuisHeureParis, formatDateHeure, formatDateHeureCourte } from "@/lib/heure";
import { expediteur, transporteur } from "@/lib/mail";
import { lireMontant } from "@/lib/montant";
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
  .transform((v) => (v === "" ? null : lireMontant(v)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v < 1e10), "Montant invalide (exemple : 1 234,56)");
const dateOpt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00Z`)))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "Date invalide");

const champs = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
const erreurDe = (e: unknown) => (e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")} : ${i.message}`).join(" · ") : e instanceof Error ? e.message : String(e));

/* ───────────── Territoires ───────────── */

/** Enveloppe une action : vérifie l'accès et transforme toute erreur en message affichable. */
function action(fn: (f: FormData) => Promise<Etat>) {
  return async (_e: Etat, f: FormData): Promise<Etat> => {
    try {
      await exigerAdmin();
      return await fn(f);
    } catch (e) {
      unstable_rethrow(e); // redirect() et notFound() doivent traverser
      return { erreur: erreurDe(e) };
    }
  };
}

export const activerDepartement = action(async (f) => {
  const code = z.string().regex(/^[0-9AB]{2,3}$/).parse(f.get("code"));
  const enCours = await db.tache.findFirst({ where: { type: "IMPORTER_DEPARTEMENT", parametre: code, statut: { in: ["EN_ATTENTE", "EN_COURS"] } } });
  if (enCours) return { erreur: "Un import de ce département est déjà en cours." };
  await db.tache.create({ data: { type: "IMPORTER_DEPARTEMENT", parametre: code } });
  refresh();
  return { ok: "Import lancé : communes, carte, comptes OFGL et coordonnées des mairies (quelques minutes)." };
});

export const desactiverDepartement = action(async (f) => {
  const code = z.string().regex(/^[0-9AB]{2,3}$/).parse(f.get("code"));
  await db.departement.update({ where: { code }, data: { actif: false } });
  refresh();
  return { ok: "Département marqué comme non couvert (les données sont conservées)." };
});

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
    const avant = await db.commune.findUniqueOrThrow({ where: { code }, select: { mairieEmail: true } });
    await db.commune.update({ where: { code }, data });
    // Le courriel de la mairie est le destinataire des demandes : on met à jour les brouillons
    // non envoyés qui utilisaient l'ancienne adresse (ou aucune).
    let suite = "";
    if (data.mairieEmail && data.mairieEmail !== avant.mairieEmail) {
      const r = await db.demande.updateMany({
        where: { communeCode: code, statut: "BROUILLON", envoiEnCoursLe: null, OR: [{ destinataire: avant.mairieEmail ?? "" }, { destinataire: "" }] },
        data: { destinataire: data.mairieEmail },
      });
      if (r.count) suite = ` Destinataire mis à jour dans ${r.count} brouillon${r.count > 1 ? "s" : ""} de demande.`;
    }
    refresh();
    return { ok: `Fiche enregistrée.${suite}` };
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

export const supprimerChantier = action(async (f) => {
  const id = z.coerce.number().int().parse(f.get("id"));
  await db.operation.deleteMany({ where: { id } }); // les documents sont conservés, simplement détachés
  refresh();
  return { ok: "Chantier supprimé ; ses documents sont conservés." };
});

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
    if (data.documentId && !(await db.document.findFirst({ where: { id: data.documentId, communeCode }, select: { id: true } }))) {
      return { erreur: "Le document justificatif choisi n'appartient pas à cette commune." };
    }
    const valeurs = { ...data, montantBrutAnnuel: montantBrutAnnuel! };
    if (id) await db.indemniteFonction.update({ where: { id, communeCode }, data: valeurs });
    else await db.indemniteFonction.create({ data: { ...valeurs, communeCode } });
    refresh();
    return { ok: "Indemnité enregistrée." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

export const supprimerIndemnite = action(async (f) => {
  await db.indemniteFonction.deleteMany({ where: { id: z.coerce.number().int().parse(f.get("id")) } });
  refresh();
  return { ok: "Ligne supprimée." };
});

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
    if (data.documentId && !(await db.document.findFirst({ where: { id: data.documentId, communeCode }, select: { id: true } }))) {
      return { erreur: "Le document justificatif choisi n'appartient pas à cette commune." };
    }
    const valeurs = { ...data, montant: montant! };
    if (id) await db.fraisFonction.update({ where: { id, communeCode }, data: valeurs });
    else await db.fraisFonction.create({ data: { ...valeurs, communeCode } });
    refresh();
    return { ok: "Frais enregistrés." };
  } catch (e) {
    return { erreur: erreurDe(e) };
  }
}

export const supprimerFrais = action(async (f) => {
  await db.fraisFonction.deleteMany({ where: { id: z.coerce.number().int().parse(f.get("id")) } });
  refresh();
  return { ok: "Ligne supprimée." };
});

/* ───────────── Demandes CRPA / CADA ───────────── */

export const creerDemande = action(async (f) => {
  const communeCode = z.string().regex(/^[0-9AB]{5}$/).parse(f.get("communeCode"));
  const annee = z.coerce.number().int().min(2000).max(2100).parse(f.get("annee"));
  const exercice = z.coerce.number().int().min(2000).max(2100).parse(f.get("exercice"));
  const pieces = f.getAll("pieces").map(String).filter((p): p is Piece => p in PIECES);
  if (pieces.length === 0) return { erreur: "Cochez au moins une pièce à demander." };
  const commune = await db.commune.findUniqueOrThrow({ where: { code: communeCode }, select: { nom: true, mairieEmail: true } });
  const existe = await db.demande.findUnique({ where: { communeCode_annee: { communeCode, annee } }, select: { id: true } });
  if (existe) return { erreur: `Une demande existe déjà pour ${annee} (une seule demande groupée par commune et par an).` };
  const cree = await db.demande.create({
    data: {
      communeCode,
      annee,
      objet: objetDemande(commune.nom, exercice),
      corps: courrierDemande(commune.nom, exercice, pieces),
      destinataire: commune.mairieEmail ?? "",
      statut: "BROUILLON",
    },
  });
  redirect(`/admin/communes/${communeCode}?onglet=demandes&cree=${cree.id}#demande-${cree.id}`);
});

const STATUTS = ["BROUILLON", "ENVOYEE", "RELANCEE", "REFUS_IMPLICITE", "REFUS_EXPRES", "CADA_SAISIE", "REPONSE_PARTIELLE", "SATISFAITE", "ABANDONNEE"] as const;

const schemaDemande = z.object({
  id: z.string().min(1).max(40),
  majLe: z.string().min(1).max(40),
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

/** Une date saisie (jour) : on garde l'instant existant si le jour n'a pas changé, sinon midi heure de Paris. */
function instantDuJour(saisie: Date | null, existant: Date | null): Date | null {
  if (!saisie) return null;
  const jourSaisi = saisie.toISOString().slice(0, 10);
  if (existant) {
    const [a, m, j] = jourParis(existant);
    if (`${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}` === jourSaisi) return existant;
  }
  return depuisHeureParis(`${jourSaisi}T12:00`);
}

export const modifierDemande = action(async (f) => {
  const { id, majLe, ...data } = schemaDemande.parse(champs(f));
  const actuelle = await db.demande.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { messages: { where: { sens: "SORTANT" } } } } },
  });
  // Formulaire ouvert avant une modification (par exemple l'envoi programmé) : on refuse d'écraser.
  if (actuelle.majLe.toISOString() !== majLe) {
    return { erreur: "La demande a changé depuis l'ouverture de cette page (envoi effectué ?). Rechargez la page avant d'enregistrer : rien n'a été modifié." };
  }
  if (actuelle.envoiEnCoursLe) return { erreur: "Un envoi de cette demande est en cours : attendez son résultat avant de la modifier." };
  const dejaEnvoyee = actuelle.envoyeeLe !== null || actuelle._count.messages > 0 || actuelle.statut !== "BROUILLON";
  if (dejaEnvoyee && data.statut === "BROUILLON") {
    return { erreur: "Une demande déjà envoyée ne peut pas redevenir un brouillon (cela permettrait de la renvoyer). Choisissez un autre statut." };
  }
  if (data.statut === "REFUS_EXPRES" && !data.reponseLe) return { erreur: "Indiquez la date de la réponse de refus : le délai de saisine de la CADA court à partir de cette date." };

  const envoyeeLe = dejaEnvoyee && !data.envoyeeLe ? actuelle.envoyeeLe : instantDuJour(data.envoyeeLe, actuelle.envoyeeLe);
  const reponseLe = instantDuJour(data.reponseLe, actuelle.reponseLe);
  const { echeanceReponse, limiteSaisineCada } = delais(envoyeeLe, data.statut === "REFUS_EXPRES" ? reponseLe : null);
  const r = await db.demande.updateMany({
    where: { id, majLe: actuelle.majLe, envoiEnCoursLe: null },
    data: {
      ...data,
      statut: data.statut as StatutDemande,
      envoyeeLe,
      reponseLe,
      relanceeLe: instantDuJour(data.relanceeLe, actuelle.relanceeLe),
      cadaSaisieLe: instantDuJour(data.cadaSaisieLe, actuelle.cadaSaisieLe),
      avisCadaLe: instantDuJour(data.avisCadaLe, actuelle.avisCadaLe),
      clotureLe: instantDuJour(data.clotureLe, actuelle.clotureLe),
      echeanceReponse,
      limiteSaisineCada,
      // Un brouillon marqué envoyé à la main (courrier postal…) ne doit plus partir par courriel.
      ...(data.statut !== "BROUILLON" ? { envoiProgrammeLe: null } : {}),
    },
  });
  if (r.count !== 1) return { erreur: "La demande a changé pendant l'enregistrement. Rechargez la page : rien n'a été modifié." };
  refresh();
  return { ok: "Demande enregistrée." };
});

export const supprimerDemande = action(async (f) => {
  // (une demande programmée reste un brouillon : la supprimer annule aussi son envoi)
  const id = z.string().min(1).parse(f.get("id"));
  const r = await db.demande.deleteMany({ where: { id, statut: "BROUILLON", envoiEnCoursLe: null, envoyeeLe: null, messages: { none: { sens: "SORTANT" } } } });
  if (r.count !== 1) return { erreur: "Seul un brouillon jamais envoyé peut être supprimé ; une demande envoyée peut être marquée « abandonnée »." };
  refresh();
  return { ok: "Brouillon supprimé." };
});

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
    const d = await db.demande.findUniqueOrThrow({ where: { id }, select: { statut: true, destinataire: true, envoiEnCoursLe: true } });
    if (d.statut !== "BROUILLON") return { erreur: "Cette demande a déjà été envoyée." };
    if (d.envoiEnCoursLe) return { erreur: "Un envoi de cette demande est déjà en cours." };
    if (!z.string().email().safeParse(d.destinataire).success) return { erreur: "Adresse du destinataire invalide : corrigez-la dans « Courrier, statut et dates »." };

    if (f.get("mode") === "programmer") {
      const quand = depuisHeureParis(String(f.get("quand") ?? ""));
      if (!quand) return { erreur: "Indiquez la date et l'heure d'envoi." };
      if (quand.getTime() < Date.now() + 60_000) return { erreur: "L'heure d'envoi doit être dans le futur." };
      if (quand.getTime() > Date.now() + 366 * 86_400_000) return { erreur: "L'envoi ne peut pas être programmé à plus d'un an." };
      const r = await db.demande.updateMany({
        where: { id, statut: "BROUILLON", envoiEnCoursLe: null },
        data: { envoiProgrammeLe: quand, envoiCopieCachee: copie, erreurEnvoi: null },
      });
      if (r.count !== 1) return { erreur: "La demande vient d'être envoyée ou est en cours d'envoi." };
      refresh();
      return { ok: `Envoi programmé le ${formatDateHeure(quand)} (heure de Paris).` };
    }

    const r = await envoyerDemandeMaintenant(id, copie);
    refresh();
    return { ok: `Demande envoyée à ${r.destinataire}. Réponse attendue au plus tard le ${formatJourParis(r.echeanceReponse!)}.` };
  } catch (e) {
    refresh();
    if (e instanceof EnvoiDejaEnCours) return { erreur: e.message };
    if (e instanceof EnvoiIncertain) return { erreur: e.message };
    return { erreur: `Envoi impossible : ${erreurDe(e)}` };
  }
}

export const annulerEnvoiProgramme = action(async (f) => {
  const id = z.string().min(1).parse(f.get("id"));
  const r = await db.demande.updateMany({ where: { id, statut: "BROUILLON", envoiEnCoursLe: null }, data: { envoiProgrammeLe: null } });
  refresh();
  return r.count ? { ok: "Envoi programmé annulé : la demande reste en brouillon." } : { erreur: "La demande a déjà été envoyée ou est en cours d'envoi." };
});

/**
 * Envoi resté « en cours » (coupure pendant la transmission, worker arrêté brutalement) :
 * l'administrateur a vérifié que le courriel N'EST PAS parti et lève la réservation.
 */
export const debloquerEnvoi = action(async (f) => {
  if (f.get("verifie") !== "oui") return { erreur: "Cochez la case : vous avez vérifié que le courriel n'est pas parti." };
  const id = z.string().min(1).parse(f.get("id"));
  const r = await db.demande.updateMany({
    where: { id, statut: "BROUILLON", envoiEnCoursLe: { not: null } },
    data: { envoiEnCoursLe: null, erreurEnvoi: null },
  });
  refresh();
  return r.count ? { ok: "Envoi débloqué : la demande peut de nouveau être envoyée." } : { erreur: "Rien à débloquer." };
});

/** Le courriel est parti (copie reçue, accusé de la mairie) mais l'état n'a pas été enregistré. */
export const marquerEnvoyee = action(async (f) => {
  if (f.get("verifie") !== "oui") return { erreur: "Cochez la case : vous avez vérifié que le courriel est bien parti." };
  const id = z.string().min(1).parse(f.get("id"));
  const d = await db.demande.findUniqueOrThrow({ where: { id } });
  if (d.statut !== "BROUILLON") return { erreur: "Cette demande est déjà marquée comme envoyée." };
  const quand = d.envoiEnCoursLe ?? new Date();
  const { echeanceReponse, limiteSaisineCada } = delais(quand);
  await db.$transaction([
    db.demande.update({
      where: { id },
      data: { statut: "ENVOYEE", envoyeeLe: quand, echeanceReponse, limiteSaisineCada, envoiEnCoursLe: null, envoiProgrammeLe: null, erreurEnvoi: null },
    }),
    db.message.create({
      data: { demandeId: id, sens: "SORTANT", de: process.env.SMTP_FROM ?? "", a: d.destinataire, sujet: d.objet, corps: d.corps, date: quand },
    }),
  ]);
  refresh();
  return { ok: `Demande marquée comme envoyée le ${formatDateHeureCourte(quand)}.` };
});

/** Relance par courriel, par le même relais que la demande, sur confirmation explicite. */
export const envoyerRelance = action(async (f) => {
  if (f.get("confirmation") !== "oui") return { erreur: "Cochez la case de confirmation." };
  const id = z.string().min(1).parse(f.get("id"));
  const corps = z.string().trim().min(50).max(20000).parse(f.get("corps"));
  const d = await db.demande.findUniqueOrThrow({ where: { id } });
  if (!["ENVOYEE", "RELANCEE", "REFUS_IMPLICITE"].includes(d.statut)) return { erreur: "Seule une demande envoyée et sans réponse peut être relancée." };
  const destinataire = z.string().email().parse(d.destinataire);
  // Réservation : au plus une relance par 24 h, même en cas de double clic ou de deux onglets.
  const maintenant = new Date();
  const r = await db.demande.updateMany({
    where: { id, OR: [{ relanceeLe: null }, { relanceeLe: { lt: new Date(maintenant.getTime() - 86_400_000) } }] },
    data: { relanceeLe: maintenant },
  });
  if (r.count !== 1) return { erreur: "Une relance a déjà été envoyée dans les dernières 24 heures." };
  const sujet = `Relance — ${d.objet}`;
  let info: { messageId?: string };
  try {
    info = await transporteur().sendMail({
      from: expediteur(),
      to: destinataire,
      bcc: d.envoiCopieCachee && process.env.ASSO_EMAIL ? process.env.ASSO_EMAIL : undefined,
      replyTo: expediteur().address,
      subject: sujet,
      text: corps,
    });
  } catch (e) {
    await db.demande.update({ where: { id }, data: { relanceeLe: d.relanceeLe } });
    return { erreur: `Relance non envoyée : ${messageErreurEnvoi(e)}` };
  }
  await db.$transaction([
    db.demande.update({ where: { id }, data: { statut: d.statut === "ENVOYEE" ? "RELANCEE" : d.statut } }),
    db.message.create({
      data: { demandeId: id, sens: "SORTANT", de: expediteur().address, a: destinataire, sujet, corps, date: maintenant, messageIdEmail: info.messageId ?? null },
    }),
  ]);
  refresh();
  return { ok: `Relance envoyée à ${destinataire}.` };
});

/** Saisine de la CADA faite (en ligne ou par courrier) : statut, date et numéro de dossier. */
export const enregistrerSaisineCada = action(async (f) => {
  const id = z.string().min(1).parse(f.get("id"));
  const date = dateOpt.parse(String(f.get("date") ?? ""));
  if (!date) return { erreur: "Indiquez la date de la saisine." };
  const numeroCada = texte(60).parse(String(f.get("numeroCada") ?? ""));
  const quand = depuisHeureParis(`${date.toISOString().slice(0, 10)}T12:00`)!;
  const d = await db.demande.findUniqueOrThrow({ where: { id }, select: { statut: true } });
  if (d.statut === "BROUILLON") return { erreur: "La demande n'a pas encore été envoyée." };
  await db.demande.update({ where: { id }, data: { statut: "CADA_SAISIE", cadaSaisieLe: quand, ...(numeroCada ? { numeroCada } : {}) } });
  refresh();
  return { ok: "Saisine de la CADA enregistrée." };
});

const schemaMessage = z.object({
  demandeId: z.string().min(1).max(40),
  sens: z.enum(["ENTRANT", "SORTANT"]),
  date: dateOpt.refine((v) => v !== null, "Date obligatoire"),
  de: z.string().trim().min(1).max(200),
  a: z.string().trim().min(1).max(200),
  sujet: z.string().trim().min(1).max(300),
  corps: z.string().trim().max(20000),
});

/** Échange consigné à la main (réponse de la mairie, courrier de la CADA…). */
export const ajouterMessage = action(async (f) => {
  const { date, ...data } = schemaMessage.parse(champs(f));
  await db.message.create({ data: { ...data, date: depuisHeureParis(`${date!.toISOString().slice(0, 10)}T12:00`)! } });
  refresh();
  return { ok: "Échange ajouté au journal." };
});

export const rattacherDocumentsDemande = action(async (f) => {
  const id = z.string().min(1).parse(f.get("id"));
  const d = await db.demande.findUniqueOrThrow({ where: { id }, select: { communeCode: true } });
  const documents = f.getAll("documents").map(String);
  await db.$transaction([
    db.document.updateMany({ where: { demandeId: id, id: { notIn: documents } }, data: { demandeId: null } }),
    db.document.updateMany({ where: { communeCode: d.communeCode, id: { in: documents } }, data: { demandeId: id } }),
  ]);
  refresh();
  return { ok: `${documents.length} document${documents.length > 1 ? "s" : ""} rattaché${documents.length > 1 ? "s" : ""} à la demande.` };
});

/* ───────────── Demandes en lot (vue département) ───────────── */

/** Prépare un brouillon pour chaque commune du département qui a un courriel et pas encore de demande pour l'année. */
export const preparerDemandesLot = action(async (f) => {
  const dep = z.string().regex(/^[0-9AB]{2,3}$/).parse(f.get("departement"));
  const annee = z.coerce.number().int().min(2000).max(2100).parse(f.get("annee"));
  const exercice = z.coerce.number().int().min(2000).max(2100).parse(f.get("exercice"));
  const communes = await db.commune.findMany({
    where: { departementCode: dep, mairieEmail: { not: null }, demandes: { none: { annee } } },
    select: { code: true, nom: true, population: true, mairieEmail: true },
  });
  const valides = communes.filter((c) => z.string().email().safeParse(c.mairieEmail).success);
  if (valides.length === 0) return { erreur: `Aucune commune à préparer : toutes ont déjà une demande ${annee} ou n'ont pas de courriel valide.` };
  const r = await db.demande.createMany({
    data: valides.map((c) => ({
      communeCode: c.code,
      annee,
      objet: objetDemande(c.nom, exercice),
      corps: courrierDemande(c.nom, exercice, piecesParDefaut(c.population)),
      destinataire: c.mairieEmail!,
      statut: "BROUILLON" as const,
    })),
    skipDuplicates: true,
  });
  refresh();
  return { ok: `${r.count} brouillon${r.count > 1 ? "s" : ""} préparé${r.count > 1 ? "s" : ""} (pièces ciblées pour les communes de 3 500 habitants et plus). Relisez-les avant de programmer l'envoi.` };
});

/** Programme l'envoi des brouillons non programmés du département, étalés (ménage le relais et la délivrabilité). */
export const programmerDemandesLot = action(async (f) => {
  if (f.get("confirmation") !== "oui") return { erreur: "Cochez la case de confirmation." };
  const dep = z.string().regex(/^[0-9AB]{2,3}$/).parse(f.get("departement"));
  const annee = z.coerce.number().int().min(2000).max(2100).parse(f.get("annee"));
  const parHeure = z.coerce.number().int().min(1).max(60).parse(f.get("parHeure"));
  const debut = depuisHeureParis(String(f.get("debut") ?? ""));
  if (!debut) return { erreur: "Indiquez la date et l'heure du premier envoi." };
  if (debut.getTime() < Date.now() + 60_000) return { erreur: "Le premier envoi doit être dans le futur." };
  const brouillons = await db.demande.findMany({
    where: { annee, statut: "BROUILLON", envoiProgrammeLe: null, envoiEnCoursLe: null, erreurEnvoi: null, commune: { departementCode: dep } },
    select: { id: true, destinataire: true, commune: { select: { population: true } } },
    orderBy: { commune: { nomRecherche: "asc" } },
  });
  const envoyables = brouillons.filter((d) => z.string().email().safeParse(d.destinataire).success);
  if (envoyables.length === 0) return { erreur: "Aucun brouillon à programmer (déjà programmés, en erreur, ou sans destinataire valide)." };
  const pas = Math.round(3600_000 / parHeure);
  await db.$transaction(
    envoyables.map((d, i) =>
      db.demande.updateMany({
        where: { id: d.id, statut: "BROUILLON", envoiProgrammeLe: null, envoiEnCoursLe: null },
        data: { envoiProgrammeLe: new Date(debut.getTime() + i * pas), envoiCopieCachee: true, erreurEnvoi: null },
      }),
    ),
  );
  const fin = new Date(debut.getTime() + (envoyables.length - 1) * pas);
  refresh();
  return { ok: `${envoyables.length} envoi${envoyables.length > 1 ? "s" : ""} programmé${envoyables.length > 1 ? "s" : ""} du ${formatDateHeure(debut)} au ${formatDateHeure(fin)} (heure de Paris).` };
});
