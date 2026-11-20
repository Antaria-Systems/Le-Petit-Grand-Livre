import type { Metadata } from "next";
import Link from "next/link";
import { verifierAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await verifierAdminPage();
  return (
    <div className="admin">
      <div className="admin-barre">
        <div className="conteneur">
          <strong>Administration</strong>
          <Link href="/admin">Documents</Link>
          <span className="discret petit">Accès temporaire par mot de passe · Authentik à venir</span>
        </div>
      </div>
      {children}
    </div>
  );
}
