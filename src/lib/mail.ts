/** Envoi de courriels (demandes CRPA, relances) via le relais SMTP configuré. */
import nodemailer from "nodemailer";
import { site } from "./config";

export function transporteur() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    name: process.env.SMTP_EHLO || new URL(site.url).hostname,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
    // Les contenus ne doivent jamais pouvoir lire un fichier local ni une URL arbitraire.
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: { minVersion: "TLSv1.2", servername: process.env.SMTP_HOST },
  });
}

export function expediteur() {
  const adresse = process.env.SMTP_FROM;
  if (!adresse) throw new Error("SMTP_FROM manquant");
  return { name: process.env.SMTP_FROM_NAME || site.nom, address: adresse };
}
