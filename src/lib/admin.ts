/**
 * Accès administrateur — TEMPORAIRE : authentification HTTP Basic (ADMIN_USER / ADMIN_PASSWORD),
 * à remplacer par le SSO Authentik (OIDC). Vérifiée deux fois : dans src/proxy.ts et dans
 * chaque route/page d'administration (défense en profondeur).
 */
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { identifiantsValides } from "./admin-auth";

export { identifiantsValides };

/** Les requêtes qui modifient des données doivent venir du site lui-même (protection CSRF). */
function memeOrigine(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origine = req.headers.get("origin");
  const hote = req.headers.get("host");
  return !!origine && !!hote && new URL(origine).host === hote;
}

/** Pour les routes API : renvoie une réponse d'erreur, ou null si l'accès est autorisé. */
export function refusAdmin(req: Request): Response | null {
  if (!identifiantsValides(req.headers.get("authorization"))) {
    return new Response("Authentification requise", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' } });
  }
  if (req.method !== "GET" && req.method !== "HEAD" && !memeOrigine(req)) {
    return new Response("Origine refusée", { status: 403 });
  }
  return null;
}

/** Pour les pages serveur d'administration. */
export async function verifierAdminPage(): Promise<void> {
  if (!identifiantsValides((await headers()).get("authorization"))) notFound();
}
