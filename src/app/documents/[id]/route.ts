import { db } from "@/lib/db";
import { lirePublic } from "@/lib/stockage";
import { normaliser } from "@/lib/texte";

/** Sert la version OCCULTÉE d'un document publié. Les originaux ne sont jamais servis ici. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    select: { statut: true, cheminPublic: true, titre: true, communeCode: true },
  });
  if (!doc || doc.statut !== "PUBLIE" || !doc.cheminPublic) {
    return new Response("Document introuvable", { status: 404 });
  }
  const pdf = await lirePublic(doc.cheminPublic);
  const nomFichier = `${doc.communeCode}-${normaliser(doc.titre).replace(/ /g, "-").slice(0, 80)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomFichier}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noarchive",
    },
  });
}
