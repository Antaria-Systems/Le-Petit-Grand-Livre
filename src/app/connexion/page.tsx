import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { adminCourant, oidcActif } from "@/lib/admin";

export const metadata: Metadata = { title: "Connexion", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ callbackUrl?: string; error?: string }> };

/** N'accepte qu'un chemin interne (pas de redirection ouverte vers un autre site). */
function cheminSur(url: string | undefined): string {
  return url && url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\") ? url : "/admin";
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
                  Ce compte n&apos;appartient pas au groupe autorisé. Dans Authentik, ajoutez-le au groupe «&nbsp;
                  {process.env.AUTH_ADMIN_GROUP}&nbsp;», puis reconnectez-vous.
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
