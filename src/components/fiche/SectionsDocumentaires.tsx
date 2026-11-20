import Link from "next/link";
import { IconeDocument } from "@/components/Icones";
import type { Prisma } from "@/generated/prisma/client";
import { formatDate, formatDateCourte, formatEuros, formatEurosCentimes } from "@/lib/format";
import { CATEGORIE_DOCUMENT, STATUT_DEMANDE } from "@/lib/statuts";

type Decimal = Prisma.Decimal;
const n = (d: Decimal | null) => (d === null ? null : Number(d));

/* ─────────────── Élus & indemnités ─────────────── */

type Indemnite = { annee: number; fonction: string; ordre: number; montantBrutAnnuel: Decimal; documentId: string | null };
type Frais = { annee: number; fonction: string; nature: string; montant: Decimal };

export function SectionElus({ indemnites, frais }: { indemnites: Indemnite[]; frais: Frais[] }) {
  const annees = [...new Set([...indemnites.map((i) => i.annee), ...frais.map((f) => f.annee)])].sort((a, b) => b - a);
  if (annees.length === 0) {
    return (
      <div className="vide">
        <strong>Pas encore de données pour cette commune.</strong>
        <p style={{ margin: "8px 0 0" }}>
          L&apos;état annuel des indemnités des élus (art. L.2123-24-1-1 du CGCT) et les justificatifs de frais sont demandés à
          la mairie dans la demande groupée annuelle. Ils apparaîtront ici après occultation des mentions protégées.
        </p>
      </div>
    );
  }
  const annee = annees[0];
  const lignes = indemnites.filter((i) => i.annee === annee).sort((a, b) => a.ordre - b.ordre);
  const fraisAnnee = frais.filter((f) => f.annee === annee);
  const total = lignes.reduce((s, l) => s + Number(l.montantBrutAnnuel), 0);
  const fraisParFonction = new Map<string, number>();
  for (const f of fraisAnnee) fraisParFonction.set(f.fonction, (fraisParFonction.get(f.fonction) ?? 0) + Number(f.montant));

  return (
    <>
      <div className="carte">
        <h3>Indemnités de fonction {annee}</h3>
        <p className="discret petit">Montants bruts. Publiés par fonction : la plateforme ne publie pas le nom des élus.</p>
        <div className="tableau-defilant">
          <table>
            <thead>
              <tr>
                <th>Fonction</th>
                <th className="nombre">Brut annuel</th>
                <th className="nombre">Brut mensuel</th>
                <th className="nombre">Frais remboursés</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={`${l.fonction}-${i}`}>
                  <td>{l.fonction}</td>
                  <td className="nombre">{formatEuros(Number(l.montantBrutAnnuel))}</td>
                  <td className="nombre">{formatEuros(Number(l.montantBrutAnnuel) / 12)}</td>
                  <td className="nombre">{fraisParFonction.has(l.fonction) ? formatEurosCentimes(fraisParFonction.get(l.fonction)!) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th className="nombre">{formatEuros(total)}</th>
                <th className="nombre">{formatEuros(total / 12)}</th>
                <th className="nombre">{fraisAnnee.length ? formatEurosCentimes(fraisAnnee.reduce((s, f) => s + Number(f.montant), 0)) : "—"}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─────────────── Travaux & marchés ─────────────── */

type Op = {
  id: number;
  intitule: string;
  categorie: string | null;
  annee: number | null;
  montantHT: Decimal | null;
  montantTTC: Decimal | null;
  prestataire: string | null;
  documentId: string | null;
};

export function SectionTravaux({ operations }: { operations: Op[] }) {
  if (operations.length === 0) {
    return (
      <div className="vide">
        <strong>Aucune opération référencée pour l&apos;instant.</strong>
        <p style={{ margin: "8px 0 0" }}>
          Les factures et devis de travaux sont demandés à la mairie. Les dépenses d&apos;équipement globales figurent déjà
          dans la section Budget ci-dessus.
        </p>
      </div>
    );
  }
  return (
    <div className="carte tableau-defilant">
      <table>
        <thead>
          <tr>
            <th>Opération</th>
            <th>Catégorie</th>
            <th className="nombre">Année</th>
            <th className="nombre">Montant TTC</th>
            <th>Entreprise</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((o) => {
            const ttc = n(o.montantTTC);
            const ht = n(o.montantHT);
            return (
              <tr key={o.id}>
                <td>{o.intitule}</td>
                <td>{o.categorie ?? "—"}</td>
                <td className="nombre">{o.annee ?? "—"}</td>
                <td className="nombre">{ttc !== null ? formatEuros(ttc) : ht !== null ? `${formatEuros(ht)} HT` : "—"}</td>
                <td>{o.prestataire ?? "—"}</td>
                <td>{o.documentId ? <Link href={`/documents/${o.documentId}`}>Document</Link> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────── Documents ─────────────── */

type Doc = { id: string; titre: string; categorie: keyof typeof CATEGORIE_DOCUMENT; annee: number | null; nbPages: number | null; publieLe: Date | null };

export function SectionDocuments({ documents }: { documents: Doc[] }) {
  if (documents.length === 0) {
    return (
      <div className="vide">
        <strong>Aucun document publié pour l&apos;instant.</strong>
      </div>
    );
  }
  return (
    <ul className="grille" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {documents.map((d) => (
        <li key={d.id}>
          <a className="carte" href={`/documents/${d.id}`} style={{ display: "flex", gap: 12 }}>
            <span style={{ color: "var(--accent)", flexShrink: 0 }}>
              <IconeDocument taille={22} />
            </span>
            <span>
              <strong style={{ display: "block" }}>{d.titre}</strong>
              <span className="discret petit">
                {CATEGORIE_DOCUMENT[d.categorie]}
                {d.annee ? ` · ${d.annee}` : ""}
                {d.nbPages ? ` · ${d.nbPages} p.` : ""}
                {d.publieLe ? ` · publié le ${formatDateCourte(d.publieLe)}` : ""}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────── Suivi des demandes ─────────────── */

type Dem = {
  id: string;
  annee: number;
  objet: string;
  statut: keyof typeof STATUT_DEMANDE;
  envoyeeLe: Date | null;
  echeanceReponse: Date | null;
  relanceeLe: Date | null;
  cadaSaisieLe: Date | null;
  clotureLe: Date | null;
  _count: { documents: number };
};

export function SectionDemandes({ demandes, emailMairie }: { demandes: Dem[]; emailMairie: string | null }) {
  if (demandes.length === 0) {
    return (
      <div className="vide">
        <strong>Aucune demande envoyée à cette mairie pour l&apos;instant.</strong>
        <p style={{ margin: "8px 0 0" }}>
          Une demande groupée par an et par commune, au titre de l&apos;article L.311-1 du CRPA. Sans réponse sous un mois, la
          demande est réputée refusée et la CADA peut être saisie.
          {emailMairie ? "" : " Aucune adresse électronique n'est référencée pour cette mairie : la demande sera envoyée par courrier."}
        </p>
      </div>
    );
  }
  return (
    <div className="grille" style={{ gridTemplateColumns: "1fr" }}>
      {demandes.map((d) => {
        const statut = STATUT_DEMANDE[d.statut];
        const etapes = [
          d.envoyeeLe && { date: d.envoyeeLe, texte: "Demande envoyée à la mairie" },
          d.echeanceReponse && { date: d.echeanceReponse, texte: "Fin du délai de réponse d'un mois (art. R.311-13 du CRPA)" },
          d.relanceeLe && { date: d.relanceeLe, texte: "Relance envoyée" },
          d.cadaSaisieLe && { date: d.cadaSaisieLe, texte: "Saisine de la CADA" },
          d.clotureLe && { date: d.clotureLe, texte: "Demande clôturée" },
        ].filter((e): e is { date: Date; texte: string } => Boolean(e));
        etapes.sort((a, b) => a.date.getTime() - b.date.getTime());
        return (
          <div className="carte" key={d.id}>
            <div className="bloc-titre" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Demande {d.annee}</h3>
              <span className={`badge ${statut.classe}`}>{statut.libelle}</span>
            </div>
            <p className="discret">{d.objet}</p>
            <ol className="chronologie">
              {etapes.map((e) => (
                <li key={e.texte}>
                  <time dateTime={e.date.toISOString()}>{formatDateCourte(e.date)}</time>
                  <span>{e.texte}</span>
                </li>
              ))}
            </ol>
            <p className="petit discret" style={{ margin: "10px 0 0" }}>
              {d._count.documents} document{d._count.documents > 1 ? "s" : ""} reçu{d._count.documents > 1 ? "s" : ""}
              {d.envoyeeLe ? ` · envoyée le ${formatDate(d.envoyeeLe)}` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
