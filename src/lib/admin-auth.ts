/** Vérification des identifiants admin (sans dépendance à Next : utilisable dans proxy.ts). */
import { createHash, timingSafeEqual } from "node:crypto";

const hash = (s: string) => createHash("sha256").update(s).digest();

/**
 * Accès HTTP Basic : uniquement sur activation EXPLICITE (ADMIN_BASIC=1) et si Authentik n'est pas
 * configuré. Une variable OIDC manquante ferme donc l'administration au lieu de l'ouvrir en Basic.
 */
export function basicActif(): boolean {
  return process.env.ADMIN_BASIC === "1" && !oidcActif();
}

export function identifiantsValides(authorization: string | null): boolean {
  if (!basicActif()) return false;
  const attendu = process.env.ADMIN_PASSWORD ?? "";
  if (attendu.length < 16 || !authorization?.startsWith("Basic ")) return false;
  const decode = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const sep = decode.indexOf(":");
  if (sep < 0) return false;
  const utilisateur = decode.slice(0, sep);
  const motDePasse = decode.slice(sep + 1);
  const okUser = timingSafeEqual(hash(utilisateur), hash(process.env.ADMIN_USER ?? "admin"));
  const okMdp = timingSafeEqual(hash(motDePasse), hash(attendu));
  return okUser && okMdp;
}

/** La connexion Authentik est active dès que ses quatre variables sont renseignées. */
export function oidcActif(): boolean {
  return Boolean(process.env.AUTH_AUTHENTIK_SECRET && process.env.AUTH_AUTHENTIK_ID && process.env.AUTH_AUTHENTIK_ISSUER && process.env.AUTH_SECRET);
}

/** Échec fermé : sans groupe requis configuré, personne n'est administrateur. */
export function groupesAutorises(groupes: string[] | undefined): boolean {
  const requis = process.env.AUTH_ADMIN_GROUP;
  return !!requis && Array.isArray(groupes) && groupes.includes(requis);
}

/** Durée maximale d'une session, même active (reconnexion obligatoire au-delà). */
export const SESSION_MAX_MS = 24 * 3600_000;
