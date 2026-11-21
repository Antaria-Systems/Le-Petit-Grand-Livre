import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { adminCourant, oidcActif } from "@/lib/admin";

export const metadata: Metadata = { title: "Connexion", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

/**
 * N'accepte qu'un chemin de l'administration (pas de redirection ouverte vers un autre site) :
 * l'URL est analysée comme le ferait le navigateur (tabulations, barres obliques inverses…).
 */
function cheminSur(url: string | undefined): string {
  if (!url || /[\x00-\x1f\\]/.test(url)) return "/admin";
  try {
    const base = "http://local.invalid";
    const u = new URL(url, base);
    return u.origin === base && (u.pathname === "/admin" || u.pathname.startsWith("/admin/")) ? u.pathname + u.search : "/admin";
  } catch {
    return "/admin";
  }
}

export default async function Connexion({ searchParams }: Props) {
  const { callbackUrl, error } = await searchParams;
  const destination = cheminSur(callbackUrl);
  if (oidcActif() && (await adminCourant())) redirect(destination);

  async function seConnecter() {
    "use server";
    await signIn("authentik", { redirectTo: destination });
  }

  return (
    <section className="section">
      <div className="conteneur page-centree">
        <div className="carte carte-connexion">
          <p className="surtitre">Espace réservé</p>
          <h1>Administration</h1>
          {!oidcActif() ? (
            <p className="discret">La connexion par Authentik n&apos;est pas encore configurée sur ce serveur.</p>
          ) : (
            <>
              {error === "AccessDenied" && (
                <p className="badge badge-alerte" style={{ whiteSpace: "normal" }}>
                  Ce compte n&apos;est pas autorisé à administrer la plateforme. Un administrateur doit l&apos;ajouter au groupe
                  d&apos;administration dans Authentik&nbsp;; reconnectez-vous ensuite.
                </p>
              )}
              {error && error !== "AccessDenied" && (
                <p className="badge badge-alerte" style={{ whiteSpace: "normal" }}>
                  La connexion a échoué ({error}). Réessayez.
                </p>
              )}
              <p className="discret">Réservé aux membres d&apos;Antaria Systems chargés de la vérification des documents.</p>
              <form action={seConnecter}>
                <button type="submit" className="bouton bouton-principal">
                  Se connecter avec Antaria Systems
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
