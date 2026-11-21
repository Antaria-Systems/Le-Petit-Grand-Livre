import Link from "next/link";
import { verifierAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { situationDemande, statutAffiche } from "@/lib/demande";
import { formatDateCourte, formatEntier } from "@/lib/format";
import { formatDateHeureCourte } from "@/lib/heure";
import { STATUT_DEMANDE } from "@/lib/statuts";

/** « il y a 12 s », « il y a 3 min », « il y a 2 h » */
function depuis(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 90) return `il y a ${s} s`;
  if (s < 5400) return `il y a ${Math.round(s / 60)} min`;
  if (s < 172_800) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86_400)} jours`;
}

export default async function TableauDeBord() {
  await verifierAdminPage(); // défense en profondeur (en plus du proxy et du layout)
  const maintenant = Date.now();
  const [parStatut, bloques, enRetard, demandes, departements, taches, battements, sansCourriel] = await Promise.all([
    db.document.groupBy({ by: ["statut"], _count: true }),
    db.document.count({ where: { statut: "OCCULTE", erreur: { not: null }, travail: null } }),
    db.document.count({ where: { statut: { in: ["RECU", "EN_ANALYSE"] }, recuLe: { lt: new Date(maintenant - 3600_000) } } }),
    db.demande.findMany({
      where: { statut: { notIn: ["SATISFAITE", "ABANDONNEE"] } },
      include: { commune: { select: { nom: true, code: true } } },
      orderBy: { echeanceReponse: "asc" },
    }),
    db.departement.findMany({ where: { actif: true }, include: { region: true, _count: { select: { communes: true } } }, orderBy: { code: "asc" } }),
    db.tache.findMany({ orderBy: { creeLe: "desc" }, take: 5 }),
    db.etat.findMany({ where: { cle: { startsWith: "battement:" } } }),
    db.commune.count({ where: { departement: { actif: true }, OR: [{ mairieEmail: null }, { mairieEmail: "" }] } }),
  ]);
  const nb = (s: string) => parStatut.find((p) => p.statut === s)?._count ?? 0;
  const ordreNiveau = { urgent: 0, attention: 1, info: 2 } as const;
  const alertes = demandes
    .map((d) => ({ d, a: situationDemande(d) }))
    .filter((x) => x.a)
    .sort((x, y) => ordreNiveau[x.a!.niveau] - ordreNiveau[y.a!.niveau]);
  const programmees = demandes.filter((d) => d.statut === "BROUILLON" && d.envoiProgrammeLe).sort((a, b) => a.envoiProgrammeLe!.getTime() - b.envoiProgrammeLe!.getTime());

  // État du worker : chaque boucle écrit un battement (envois toutes les 30 s, documents toutes les 5 s au repos).
  const boucles = [
    { cle: "battement:envois", libelle: "Envois programmés et imports", seuil: 3 * 60_000 },
    { cle: "battement:documents", libelle: "Analyse des documents", seuil: 3 * 60_000 },
  ].map((b) => {
    const v = battements.find((x) => x.cle === b.cle)?.valeur;
    const age = v ? maintenant - new Date(v).getTime() : null;
    // Un document long peut occuper la boucle des documents plusieurs minutes : seuil plus large.
    const seuil = b.cle === "battement:documents" && nb("EN_ANALYSE") + nb("RECU") > 0 ? 30 * 60_000 : b.seuil;
    return { ...b, age, ok: age !== null && age < seuil };
  });
  const workerEnPanne = boucles.find((b) => b.cle === "battement:envois" && !b.ok);

  return (
    <section className="section">
      <div className="conteneur">
        <h1>Tableau de bord</h1>
        {workerEnPanne && (
          <p className="alerte alerte-urgent" role="alert">
            Le traitement des envois ne répond plus{workerEnPanne.age !== null ? ` (dernier signal ${depuis(workerEnPanne.age)})` : ""} : les envois programmés ne
            partiront pas. Vérifiez le conteneur du worker sur le serveur.
          </p>
        )}
        <dl className="chiffres-cles">
          <div>
            <dt>Documents à vérifier</dt>
            <dd>
              <Link href="/admin/documents?statut=A_VERIFIER">{nb("A_VERIFIER")}</Link>
            </dd>
          </div>
          <div className={bloques ? "chiffre-alerte" : undefined}>
            <dt>Bloqués par le contrôle</dt>
            <dd>
              <Link href="/admin/documents?bloques=1">{bloques}</Link>
            </dd>
          </div>
          <div>
            <dt>En file d&apos;analyse</dt>
            <dd>
              <Link href="/admin/documents?statut=RECU">{nb("RECU") + nb("EN_ANALYSE")}</Link>
            </dd>
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
            <h2 className="titre-carte">À faire</h2>
            {alertes.length === 0 && bloques === 0 && enRetard === 0 ? (
              <p className="discret">Aucune échéance en vue.</p>
            ) : (
              <ul className="liste-alertes">
                {bloques > 0 && (
                  <li className="alerte-urgent">
                    <Link href="/admin/documents?bloques=1">
                      {bloques} document{bloques > 1 ? "s" : ""} bloqué{bloques > 1 ? "s" : ""}
                    </Link>
                    <span>une coordonnée reste lisible dans la version occultée : à corriger avant publication</span>
                  </li>
                )}
                {enRetard > 0 && (
                  <li className="alerte-attention">
                    <Link href="/admin/documents?statut=RECU">
                      {enRetard} document{enRetard > 1 ? "s" : ""} en attente
                    </Link>
                    <span>reçus il y a plus d&apos;une heure et toujours pas analysés</span>
                  </li>
                )}
                {alertes.map(({ d, a }) => {
                  const statut = statutAffiche(d) ?? STATUT_DEMANDE[d.statut];
                  return (
                    <li key={d.id} className={`alerte-${a!.niveau}`}>
                      <Link href={`/admin/communes/${d.commune.code}?onglet=demandes#demande-${d.id}`}>{d.commune.nom}</Link>
                      <span className={`badge ${statut.classe}`}>{statut.libelle}</span>
                      <span>{a!.texte}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {demandes.some((d) => d.statut === "BROUILLON" && !d.envoiProgrammeLe && !d.erreurEnvoi && !d.envoiEnCoursLe) && (
              <p className="petit">
                {(() => {
                  const n = demandes.filter((d) => d.statut === "BROUILLON" && !d.envoiProgrammeLe && !d.erreurEnvoi && !d.envoiEnCoursLe).length;
                  return `${n} brouillon${n > 1 ? "s" : ""} prêt${n > 1 ? "s" : ""} à relire`;
                })()}{" "}
                — <Link href="/admin/demandes?statut=BROUILLON">voir</Link>
              </p>
            )}
            {sansCourriel > 0 && (
              <p className="petit discret">
                {formatEntier(sansCourriel)} commune{sansCourriel > 1 ? "s" : ""} du périmètre sans courriel de mairie (aucune demande possible par courriel).
              </p>
            )}
          </div>
          <div className="carte">
            <h2 className="titre-carte">Envois programmés</h2>
            {programmees.length === 0 ? (
              <p className="discret">Aucun envoi programmé.</p>
            ) : (
              <ul className="liste-simple">
                {programmees.map((d) => (
                  <li key={d.id}>
                    <Link href={`/admin/communes/${d.commune.code}?onglet=demandes#demande-${d.id}`}>{d.commune.nom}</Link>{" "}
                    <span className="discret">· {formatDateHeureCourte(d.envoiProgrammeLe!)}</span>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="titre-carte" style={{ marginTop: 16 }}>
              Traitement en arrière-plan
            </h3>
            <ul className="liste-simple petit">
              {boucles.map((b) => (
                <li key={b.cle}>
                  <span className={`badge ${b.ok ? "badge-ok" : "badge-alerte"}`}>{b.ok ? "Actif" : "Sans signal"}</span> {b.libelle}
                  <span className="discret"> · {b.age === null ? "aucun signal reçu" : `dernier signal ${depuis(b.age)}`}</span>
                </li>
              ))}
            </ul>
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
