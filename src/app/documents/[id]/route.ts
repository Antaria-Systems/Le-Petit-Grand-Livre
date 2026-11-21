import { db } from "@/lib/db";
import { lirePublic } from "@/lib/stockage";
import { normaliser } from "@/lib/texte";

/**
 * Sert la version OCCULTÉE d'un document publié. Les originaux ne sont jamais servis ici.
 * Cache : « no-cache » + ETag (empreinte de la version publique) — le navigateur revalide à chaque
 * ouverture (réponse 304 sans contenu), donc un document retiré en urgence disparaît immédiatement.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    select: { statut: true, cheminPublic: true, sha256Public: true, titre: true, communeCode: true, publieLe: true, majLe: true },
  });
  if (!doc || doc.statut !== "PUBLIE" || !doc.cheminPublic) {
    return new Response("Document introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const etag = `"${doc.sha256Public ?? doc.majLe.getTime().toString(36)}"`;
  const entetes: Record<string, string> = {
    "Cache-Control": "public, no-cache",
    ETag: etag,
    "Last-Modified": (doc.publieLe ?? doc.majLe).toUTCString(),
    "X-Robots-Tag": "noarchive",
    "Accept-Ranges": "bytes",
  };
  const siPasModifie = req.headers.get("if-none-match");
  if (siPasModifie && siPasModifie.split(",").some((e) => e.trim() === etag)) {
    return new Response(null, { status: 304, headers: entetes });
  }

  const pdf = await lirePublic(doc.cheminPublic);
  const nomFichier = `${doc.communeCode}-${normaliser(doc.titre).replace(/ /g, "-").slice(0, 80)}.pdf`;
  entetes["Content-Type"] = "application/pdf";
  entetes["Content-Disposition"] = `inline; filename="${nomFichier}"`;

  // Plage d'octets (reprise de téléchargement, visionneuses PDF progressives).
  const plage = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (plage && (plage[1] || plage[2])) {
    const taille = pdf.length;
    let debut = plage[1] ? Number(plage[1]) : taille - Number(plage[2]);
    let fin = plage[1] && plage[2] ? Number(plage[2]) : taille - 1;
    debut = Math.max(0, debut);
    fin = Math.min(taille - 1, fin);
    if (debut > fin || debut >= taille) {
      return new Response(null, { status: 416, headers: { ...entetes, "Content-Range": `bytes */${taille}` } });
    }
    const morceau = pdf.subarray(debut, fin + 1);
    return new Response(new Uint8Array(morceau), {
      status: 206,
      headers: { ...entetes, "Content-Range": `bytes ${debut}-${fin}/${taille}`, "Content-Length": String(morceau.length) },
    });
  }
  return new Response(new Uint8Array(pdf), { headers: { ...entetes, "Content-Length": String(pdf.length) } });
}
