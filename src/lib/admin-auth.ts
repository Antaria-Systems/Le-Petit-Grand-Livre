/** Vérification des identifiants admin (sans dépendance à Next : utilisable dans proxy.ts). */
import { createHash, timingSafeEqual } from "node:crypto";

const hash = (s: string) => createHash("sha256").update(s).digest();

export function identifiantsValides(authorization: string | null): boolean {
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

/** La connexion Authentik est active dès que son secret est renseigné ; sinon, accès provisoire Basic. */
export function oidcActif(): boolean {
  return Boolean(process.env.AUTH_AUTHENTIK_SECRET && process.env.AUTH_AUTHENTIK_ID && process.env.AUTH_AUTHENTIK_ISSUER && process.env.AUTH_SECRET);
}

export function groupesAutorises(groupes: string[] | undefined): boolean {
  const requis = process.env.AUTH_ADMIN_GROUP;
  return !requis || (Array.isArray(groupes) && groupes.includes(requis));
}
