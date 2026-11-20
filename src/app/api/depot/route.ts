/**
 * Dépôt d'un document (PDF, image ou ZIP) depuis l'administration.
 * Route HORS du proxy : celui-ci tronque les corps de requête au-delà de 10 Mo. L'accès est donc
 * vérifié ici, AVANT toute lecture du corps (session administrateur + même origine).
 */
import { z } from "zod";
import { refusAdmin } from "@/lib/admin";
import { CATEGORIES } from "@/lib/admin-schemas";
import { db } from "@/lib/db";
import { importerDepot, LIMITES } from "@/lib/import-documents";

const parametres = z.object({
  commune: z.string().regex(/^[0-9AB]{5}$/),
  nom: z.string().min(1).max(300),
  lot: z.string().trim().min(1).max(200),
  categorie: z.enum(CATEGORIES).optional(),
});

/** Lit le corps en mémoire en s'arrêtant au-delà de la limite. */
async function lireCorps(req: Request, max: number): Promise<Buffer | null> {
  if (!req.body) return Buffer.alloc(0);
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lecteur.cancel();
      return null;
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux);
}

export async function POST(req: Request) {
  const refus = await refusAdmin(req);
  if (refus) return refus;

  const url = new URL(req.url);
  const p = parametres.safeParse({
    commune: url.searchParams.get("commune") ?? "",
    nom: url.searchParams.get("nom") ?? "",
    lot: url.searchParams.get("lot") ?? "",
    categorie: url.searchParams.get("categorie") || undefined,
  });
  if (!p.success) return Response.json({ erreur: "Paramètres invalides" }, { status: 400 });

  const commune = await db.commune.findUnique({ where: { code: p.data.commune }, select: { code: true } });
  if (!commune) return Response.json({ erreur: "Commune inconnue" }, { status: 404 });

  if (Number(req.headers.get("content-length") ?? 0) > LIMITES.envoi) {
    return Response.json({ erreur: "Fichier trop volumineux (100 Mo maximum par envoi)" }, { status: 413 });
  }
  const contenu = await lireCorps(req, LIMITES.envoi);
  if (!contenu) return Response.json({ erreur: "Fichier trop volumineux (100 Mo maximum par envoi)" }, { status: 413 });
  if (contenu.length === 0) return Response.json({ erreur: "Fichier vide" }, { status: 400 });

  const resultats = await importerDepot({ communeCode: commune.code, lot: p.data.lot, categorieForcee: p.data.categorie }, p.data.nom, contenu);
  return Response.json({ resultats });
}
