/**
 * Contrôle d'accès à l'administration, vérifié deux fois : dans src/proxy.ts puis dans chaque
 * route ou page d'administration (défense en profondeur).
 *  - Authentik (OIDC) dès que AUTH_AUTHENTIK_SECRET est renseigné ;
 *  - sinon, accès provisoire HTTP Basic (ADMIN_USER / ADMIN_PASSWORD).
 */
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { groupesAutorises, identifiantsValides, oidcActif } from "./admin-auth";

export { oidcActif };

/** Utilisateur administrateur courant, ou null. */
export async function adminCourant(): Promise<{ nom: string; mode: "oidc" | "basic" } | null> {
  if (oidcActif()) {
    const session = await auth();
    if (!session?.user || !groupesAutorises(session.user.groups)) return null;
    return { nom: session.user.name ?? session.user.email ?? "Administrateur", mode: "oidc" };
  }
  return identifiantsValides((await headers()).get("authorization")) ? { nom: process.env.ADMIN_USER ?? "admin", mode: "basic" } : null;
}

/** Les requêtes qui modifient des données doivent venir du site lui-même (protection CSRF). */
function memeOrigine(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origine = req.headers.get("origin");
  const hote = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return !!origine && !!hote && new URL(origine).host === hote;
}

/** Pour les routes API : renvoie une réponse d'erreur, ou null si l'accès est autorisé. */
export async function refusAdmin(req: Request): Promise<Response | null> {
  if (!(await adminCourant())) {
    return oidcActif()
      ? new Response("Non autorisé", { status: 401 })
      : new Response("Authentification requise", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="admin", charset="UTF-8"' } });
  }
  if (req.method !== "GET" && req.method !== "HEAD" && !memeOrigine(req)) {
    return new Response("Origine refusée", { status: 403 });
  }
  return null;
}

/** Pour les pages serveur d'administration. */
export async function verifierAdminPage(): Promise<{ nom: string; mode: "oidc" | "basic" }> {
  const admin = await adminCourant();
  if (admin) return admin;
  if (oidcActif()) redirect("/connexion");
  notFound();
}
