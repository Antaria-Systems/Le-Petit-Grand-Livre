import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import { RechercheAdmin } from "@/components/admin/RechercheAdmin";
import { BoutonTheme } from "@/components/BoutonTheme";
import { LogoRegistre } from "@/components/Icones";
import { site } from "@/lib/config";
import { verifierAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await verifierAdminPage();

  async function seDeconnecter() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="admin">
      <nav className="liens-evitement" aria-label="Accès rapide">
        <ul>
          <li>
            <a href="#contenu">Contenu</a>
          </li>
        </ul>
      </nav>
      <div className="admin-barre">
        <div className="conteneur">
          <Link href="/admin" className="admin-marque" title={`${site.nom} · administration`}>
            <LogoRegistre taille={28} />
            Administration
          </Link>
          <Link href="/admin/regions">Territoires</Link>
          <Link href="/admin/demandes">Demandes</Link>
          <Link href="/admin/documents">Documents</Link>
          <Link href="/admin/depot">Déposer</Link>
          <RechercheAdmin />
          <span className="discret petit">
            {admin.mode === "oidc" ? admin.nom : "Accès provisoire par mot de passe"}
          </span>
          <Link href="/" className="admin-site">
            Site public ↗
          </Link>
          <BoutonTheme />
          {admin.mode === "oidc" && (
            <form action={seDeconnecter}>
              <button type="submit" className="lien-bouton">
                Se déconnecter
              </button>
            </form>
          )}
        </div>
      </div>
      <main id="contenu">{children}</main>
    </div>
  );
}
