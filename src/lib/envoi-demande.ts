/**
 * Envoi d'une demande CRPA par courriel — immédiat (depuis l'admin) ou programmé (par le worker).
 * Un seul chemin d'envoi, pour que les deux produisent exactement le même résultat.
 *
 * Garantie : une demande n'est JAMAIS envoyée deux fois.
 *  1. Réservation atomique (envoiEnCoursLe) AVANT l'appel SMTP : un second appel concurrent
 *     (deux onglets, worker + bouton, deux workers) est refusé.
 *  2. La réservation n'est levée que si le relais a refusé le message de façon certaine.
 *  3. Si le courriel est parti mais que la base n'a pas pu être mise à jour, la réservation reste
 *     posée et un message « NE PAS RENVOYER » est affiché dans l'administration.
 */
import type { Transporter } from "nodemailer";
import { z } from "zod";
import { site } from "./config";
import { db } from "./db";
import { delais, formatJourParis } from "./demande";
import { formatDateHeureCourte } from "./heure";
import { expediteur, transporteur } from "./mail";

/** Un envoi est déjà en cours ou a déjà eu lieu : rien n'a été fait. */
export class EnvoiDejaEnCours extends Error {}
/** Le courriel est (peut-être) parti, mais l'état n'a pas pu être enregistré : ne pas renvoyer. */
export class EnvoiIncertain extends Error {}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retard au-delà duquel un envoi programmé n'est plus fait automatiquement (worker arrêté…). */
export const RETARD_MAX_MS = 6 * 3600_000;

/** Traduit les erreurs SMTP courantes ; le détail technique reste entre parenthèses. */
export function messageErreurEnvoi(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; response?: string; message?: string };
  const detail = (err.response || err.message || String(e)).slice(0, 300);
  const code = err.code ?? "";
  let texte = "le relais de messagerie a refusé l'envoi";
  if (code === "EDNS" || /ENOTFOUND|EAI_AGAIN/.test(detail)) texte = "relais de messagerie introuvable (DNS)";
  else if (code === "ECONNECTION" || code === "ESOCKET" || /ECONNREFUSED|ECONNRESET|EHOSTUNREACH/.test(detail)) texte = "relais de messagerie injoignable";
  else if (code === "ETIMEDOUT") texte = "le relais de messagerie ne répond pas (délai dépassé)";
  else if (code === "EAUTH") texte = "authentification refusée par le relais de messagerie";
  else if (code === "EENVELOPE" || err.responseCode === 550 || err.responseCode === 553) {
    texte = /relay|not permitted|invalid credentials/i.test(detail)
      ? "le relais refuse d'envoyer depuis ce serveur (adresse IP non autorisée ?)"
      : "adresse refusée par le serveur de messagerie";
  }
  return `${texte} (${detail})`;
}

/** Le relais a-t-il pu accepter le message malgré l'erreur ? (coupure pendant ou après DATA) */
function issueIncertaine(e: unknown): boolean {
  const err = e as { command?: string; code?: string };
  return err.command === "DATA" || (err.code === "ETIMEDOUT" && err.command !== "CONN" && err.command !== "EHLO" && err.command !== "STARTTLS");
}

export async function envoyerDemandeMaintenant(id: string, copieCachee: boolean, transport: Transporter = transporteur()) {
  const avant = await db.demande.findUniqueOrThrow({ where: { id }, select: { statut: true, envoiEnCoursLe: true, destinataire: true } });
  if (avant.statut !== "BROUILLON") throw new EnvoiDejaEnCours("Cette demande a déjà été envoyée.");
  if (avant.envoiEnCoursLe) throw new EnvoiDejaEnCours("Un envoi de cette demande est déjà en cours.");
  const verif = z.string().email().safeParse(avant.destinataire);
  if (!verif.success) throw new Error(`adresse du destinataire invalide (« ${avant.destinataire || "vide"} »)`);

  // 1. Réservation atomique
  const reserveLe = new Date();
  const reservation = await db.demande.updateMany({
    where: { id, statut: "BROUILLON", envoiEnCoursLe: null },
    data: { envoiEnCoursLe: reserveLe, envoiProgrammeLe: null, erreurEnvoi: null },
  });
  if (reservation.count !== 1) throw new EnvoiDejaEnCours("Un envoi de cette demande est déjà en cours ou a déjà eu lieu.");

  // Relecture après réservation : c'est ce contenu-là qui part.
  const d = await db.demande.findUniqueOrThrow({ where: { id } });
  const destinataire = z.string().email().parse(d.destinataire);

  // 2. Envoi
  let info: { messageId?: string };
  try {
    info = await transport.sendMail({
      from: expediteur(),
      to: destinataire,
      bcc: copieCachee && site.asso.email ? site.asso.email : undefined,
      replyTo: expediteur().address,
      subject: d.objet,
      text: d.corps,
    });
  } catch (e) {
    if (issueIncertaine(e)) {
      const message = `ÉTAT INCERTAIN : la connexion au relais a été coupée pendant la transmission (${formatDateHeureCourte(reserveLe)}). Vérifiez dans la boîte de l'association (copie cachée) ou auprès de la mairie si le courriel est arrivé avant toute autre action. ${messageErreurEnvoi(e)}`;
      await db.demande.update({ where: { id }, data: { erreurEnvoi: message.slice(0, 1000) } }).catch(() => {});
      throw new EnvoiIncertain(message);
    }
    // Refus certain : rien n'est parti, la demande redevient envoyable.
    await db.demande.update({ where: { id }, data: { envoiEnCoursLe: null } });
    throw new Error(messageErreurEnvoi(e));
  }

  // 3. Enregistrement (avec nouvelles tentatives : le courriel est parti, il ne doit plus repartir)
  const maintenant = new Date();
  const { echeanceReponse, limiteSaisineCada } = delais(maintenant);
  let derniere: unknown;
  for (let essai = 1; essai <= 4; essai++) {
    try {
      await db.$transaction([
        db.demande.update({
          where: { id },
          data: { statut: "ENVOYEE", envoyeeLe: maintenant, echeanceReponse, limiteSaisineCada, envoiProgrammeLe: null, envoiEnCoursLe: null, erreurEnvoi: null },
        }),
        db.message.create({
          data: {
            demandeId: id,
            sens: "SORTANT",
            de: expediteur().address,
            a: destinataire,
            sujet: d.objet,
            corps: d.corps,
            date: maintenant,
            messageIdEmail: info.messageId ?? null,
          },
        }),
      ]);
      return { destinataire, echeanceReponse };
    } catch (e) {
      derniere = e;
      await attendre(1000 * essai);
    }
  }
  const message = `COURRIEL PARTI le ${formatDateHeureCourte(maintenant)} (Message-ID ${info.messageId ?? "inconnu"}), mais son enregistrement a échoué : NE PAS RENVOYER. Utilisez « Marquer comme envoyée ». (${derniere instanceof Error ? derniere.message.slice(0, 200) : String(derniere)})`;
  await db.demande.update({ where: { id }, data: { erreurEnvoi: message.slice(0, 1000) } }).catch(() => {});
  throw new EnvoiIncertain(message);
}

/**
 * Envoie les demandes dont l'heure programmée est passée. La réservation atomique de
 * envoyerDemandeMaintenant garantit un seul envoi, même si deux workers tournaient.
 * Un échec n'est PAS retenté automatiquement : l'erreur est affichée dans l'admin.
 */
export async function traiterEnvoisProgrammes(log: (l: string) => void = console.log, transport?: Transporter): Promise<number> {
  const maintenant = new Date();
  const dues = await db.demande.findMany({
    where: { statut: "BROUILLON", envoiProgrammeLe: { lte: maintenant }, envoiEnCoursLe: null },
    select: { id: true, envoiProgrammeLe: true, envoiCopieCachee: true, commune: { select: { nom: true } } },
  });
  let envoyees = 0;
  for (const d of dues) {
    const prevu = d.envoiProgrammeLe!;
    // Worker arrêté longtemps : on n'envoie pas un courrier avec des jours de retard sans le dire.
    if (maintenant.getTime() - prevu.getTime() > RETARD_MAX_MS) {
      const heures = Math.round((maintenant.getTime() - prevu.getTime()) / 3600_000);
      await db.demande.updateMany({
        where: { id: d.id, statut: "BROUILLON", envoiProgrammeLe: prevu, envoiEnCoursLe: null },
        data: {
          envoiProgrammeLe: null,
          erreurEnvoi: `Envoi programmé le ${formatDateHeureCourte(prevu)} non effectué : le traitement des envois était arrêté (retard de ${heures} h). Rien n'est parti : vérifiez puis reprogrammez.`,
        },
      });
      log(`[envoi programmé] ${d.commune.nom} : retard de ${heures} h, envoi annulé (à reprogrammer)`);
      continue;
    }
    try {
      const r = await envoyerDemandeMaintenant(d.id, d.envoiCopieCachee, transport);
      envoyees++;
      log(`[envoi programmé] ${d.commune.nom} : demande envoyée, réponse attendue avant le ${formatJourParis(r.echeanceReponse!)}`);
    } catch (e) {
      if (e instanceof EnvoiDejaEnCours) continue; // un autre processus s'en occupe
      const message = e instanceof Error ? e.message : String(e);
      if (!(e instanceof EnvoiIncertain)) {
        await db.demande.update({
          where: { id: d.id },
          data: { erreurEnvoi: `Envoi programmé pour le ${formatDateHeureCourte(prevu)} non effectué : ${message}`.slice(0, 1000) },
        });
      }
      log(`[envoi programmé] ${d.commune.nom} : ÉCHEC — ${message}`);
    }
  }
  return envoyees;
}
