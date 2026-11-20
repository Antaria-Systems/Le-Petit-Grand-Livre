/**
 * Envoi d'une demande CRPA par courriel — immédiat (depuis l'admin) ou programmé (par le worker).
 * Un seul chemin d'envoi, pour que les deux produisent exactement le même résultat.
 */
import type { Transporter } from "nodemailer";
import { z } from "zod";
import { site } from "./config";
import { db } from "./db";
import { delais } from "./demande";
import { formatDateHeureCourte } from "./heure";
import { expediteur, transporteur } from "./mail";

export async function envoyerDemandeMaintenant(id: string, copieCachee: boolean, transport: Transporter = transporteur()) {
  const d = await db.demande.findUniqueOrThrow({ where: { id } });
  if (d.statut !== "BROUILLON") throw new Error("Cette demande a déjà été envoyée.");
  const verif = z.string().email().safeParse(d.destinataire);
  if (!verif.success) throw new Error(`adresse du destinataire invalide (« ${d.destinataire || "vide"} »)`);
  const destinataire = verif.data;
  const info = await transport.sendMail({
    from: expediteur(),
    to: destinataire,
    bcc: copieCachee && site.asso.email ? site.asso.email : undefined,
    replyTo: expediteur().address,
    subject: d.objet,
    text: d.corps,
  });
  const maintenant = new Date();
  const { echeanceReponse, limiteSaisineCada } = delais(maintenant);
  await db.$transaction([
    db.demande.update({
      where: { id },
      data: { statut: "ENVOYEE", envoyeeLe: maintenant, echeanceReponse, limiteSaisineCada, envoiProgrammeLe: null, erreurEnvoi: null },
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
}

/**
 * Envoie les demandes dont l'heure programmée est passée. Chaque demande est d'abord « réservée »
 * (programmation effacée de façon atomique) : jamais deux envois, même si deux workers tournaient.
 * Un échec n'est PAS retenté automatiquement : l'erreur est affichée dans l'admin.
 */
export async function traiterEnvoisProgrammes(log: (l: string) => void = console.log, transport?: Transporter): Promise<number> {
  const maintenant = new Date();
  const dues = await db.demande.findMany({
    where: { statut: "BROUILLON", envoiProgrammeLe: { lte: maintenant } },
    select: { id: true, envoiProgrammeLe: true, envoiCopieCachee: true, commune: { select: { nom: true } } },
  });
  let envoyees = 0;
  for (const d of dues) {
    const reservee = await db.demande.updateMany({
      where: { id: d.id, statut: "BROUILLON", envoiProgrammeLe: { lte: maintenant } },
      data: { envoiProgrammeLe: null },
    });
    if (reservee.count !== 1) continue;
    try {
      const r = await envoyerDemandeMaintenant(d.id, d.envoiCopieCachee, transport);
      envoyees++;
      log(`[envoi programmé] ${d.commune.nom} : demande envoyée à ${r.destinataire}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await db.demande.update({
        where: { id: d.id },
        data: { erreurEnvoi: `Envoi programmé pour le ${formatDateHeureCourte(d.envoiProgrammeLe!)} non effectué : ${message}`.slice(0, 1000) },
      });
      log(`[envoi programmé] ${d.commune.nom} : ÉCHEC — ${message}`);
    }
  }
  return envoyees;
}
