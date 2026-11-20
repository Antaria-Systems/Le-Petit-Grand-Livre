import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
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
      <div className="admin-barre">
        <div className="conteneur">
          <strong>Administration</strong>
          <Link href="/admin">Documents</Link>
          <span className="discret petit">
            {admin.mode === "oidc" ? admin.nom : "Accès provisoire par mot de passe"}
          </span>
          {admin.mode === "oidc" && (
            <form action={seDeconnecter}>
              <button type="submit" className="lien-bouton">
                Se déconnecter
              </button>
            </form>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
