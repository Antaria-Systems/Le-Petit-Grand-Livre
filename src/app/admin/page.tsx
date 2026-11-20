import Link from "next/link";
import { db } from "@/lib/db";
import { situationDemande } from "@/lib/demande";
import { formatDateCourte, formatEntier } from "@/lib/format";
import { STATUT_DEMANDE } from "@/lib/statuts";

export default async function TableauDeBord() {
  const [parStatut, demandes, departements, taches] = await Promise.all([
    db.document.groupBy({ by: ["statut"], _count: true }),
    db.demande.findMany({
      where: { statut: { notIn: ["SATISFAITE", "ABANDONNEE"] } },
      include: { commune: { select: { nom: true, code: true } } },
      orderBy: { echeanceReponse: "asc" },
    }),
    db.departement.findMany({ where: { actif: true }, include: { region: true, _count: { select: { communes: true } } }, orderBy: { code: "asc" } }),
    db.tache.findMany({ orderBy: { creeLe: "desc" }, take: 5 }),
  ]);
  const nb = (s: string) => parStatut.find((p) => p.statut === s)?._count ?? 0;
  const alertes = demandes
    .map((d) => ({ d, a: situationDemande(d) }))
    .filter((x) => x.a)
    .sort((x, y) => (x.a!.niveau === "urgent" ? -1 : 1) - (y.a!.niveau === "urgent" ? -1 : 1));

  return (
    <section className="section">
      <div className="conteneur">
        <h1>Tableau de bord</h1>
        <dl className="chiffres-cles">
          <div>
            <dt>Documents à vérifier</dt>
            <dd>
              <Link href="/admin/documents?statut=A_VERIFIER">{nb("A_VERIFIER")}</Link>
            </dd>
          </div>
          <div>
            <dt>En analyse ou en attente</dt>
            <dd>{nb("RECU") + nb("EN_ANALYSE") + nb("OCCULTE")}</dd>
          </div>
          <div>
            <dt>Documents publiés</dt>
            <dd>{formatEntier(nb("PUBLIE"))}</dd>
          </div>
          <div>
            <dt>Demandes en cours</dt>
            <dd>
              <Link href="/admin/demandes">{demandes.filter((d) => d.statut !== "BROUILLON").length}</Link>
            </dd>
          </div>
        </dl>

        <div className="travaux-grille">
          <div className="carte">
            <h2 className="titre-carte">Demandes à suivre</h2>
            {alertes.length === 0 ? (
              <p className="discret">Aucune échéance en vue.</p>
            ) : (
              <ul className="liste-alertes">
                {alertes.map(({ d, a }) => (
                  <li key={d.id} className={`alerte-${a!.niveau}`}>
                    <Link href={`/admin/communes/${d.commune.code}?onglet=demandes`}>{d.commune.nom}</Link>
                    <span className={`badge ${STATUT_DEMANDE[d.statut].classe}`}>{STATUT_DEMANDE[d.statut].libelle}</span>
                    <span>{a!.texte}</span>
                  </li>
                ))}
              </ul>
            )}
            {demandes.some((d) => d.statut === "BROUILLON") && (
              <p className="petit">
                {demandes.filter((d) => d.statut === "BROUILLON").length} brouillon(s) prêt(s) à relire —{" "}
                <Link href="/admin/demandes?statut=BROUILLON">voir</Link>
              </p>
            )}
          </div>
          <div className="carte">
            <h2 className="titre-carte">Territoires couverts</h2>
            <ul className="liste-simple">
              {departements.map((d) => (
                <li key={d.code}>
                  <Link href={`/admin/departements/${d.code}`}>
                    {d.nom} ({d.code})
                  </Link>{" "}
                  <span className="discret">
                    · {d.region.nom} · {formatEntier(d._count.communes)} communes
                  </span>
                </li>
              ))}
            </ul>
            <p className="petit">
              <Link href="/admin/regions">Couvrir un nouveau département →</Link>
            </p>
            {taches.length > 0 && (
              <>
                <h3 className="titre-carte" style={{ marginTop: 16 }}>
                  Imports récents
                </h3>
                <ul className="liste-simple petit">
                  {taches.map((t) => (
                    <li key={t.id}>
                      Département {t.parametre} · {t.statut === "TERMINEE" ? "terminé" : t.statut === "ERREUR" ? "erreur" : t.statut === "EN_COURS" ? "en cours" : "en attente"} ·{" "}
                      {formatDateCourte(t.creeLe)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
