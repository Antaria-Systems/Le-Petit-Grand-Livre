import Link from "next/link";
import { notFound } from "next/navigation";
import { preparerDemandesLot, programmerDemandesLot } from "@/app/admin/actions";
import { FormulaireAction } from "@/components/admin/FormulaireAction";
import { TableCommunes, type LigneCommune } from "@/components/admin/TableCommunes";
import { versHeureParis } from "@/lib/heure";
import { statsCommunes } from "@/lib/admin-stats";
import { db } from "@/lib/db";
import type { STATUT_DEMANDE } from "@/lib/statuts";
import { verifierAdminPage } from "@/lib/admin";

export default async function AdminDepartement({ params }: { params: Promise<{ code: string }> }) {
  await verifierAdminPage(); // défense en profondeur (en plus du proxy et du layout)
  const { code } = await params;
  const dep = await db.departement.findUnique({
    where: { code },
    include: { region: true, communes: { orderBy: { nomRecherche: "asc" }, select: { code: true, nom: true, population: true, mairieEmail: true } } },
  });
  if (!dep) notFound();
  const stats = await statsCommunes(dep.communes.map((c) => c.code));
  const annee = new Date().getFullYear();
  const [aPreparer, aProgrammer] = await Promise.all([
    db.commune.count({ where: { departementCode: code, mairieEmail: { not: null }, demandes: { none: { annee } } } }),
    db.demande.count({ where: { annee, statut: "BROUILLON", envoiProgrammeLe: null, envoiEnCoursLe: null, erreurEnvoi: null, commune: { departementCode: code } } }),
  ]);
  // Proposition : prochain jour ouvré à 9 h (heure de Paris)
  const proposition = (() => {
    for (let j = 1; j <= 7; j++) {
      const jour = versHeureParis(new Date(Date.now() + j * 86_400_000)).slice(0, 10);
      const semaine = new Date(`${jour}T12:00:00Z`).getUTCDay();
      if (semaine !== 0 && semaine !== 6) return `${jour}T09:00`;
    }
    return "";
  })();
  const lignes: LigneCommune[] = dep.communes
    .map((c) => {
      const s = stats.get(c.code);
      return {
        code: c.code,
        nom: c.nom,
        population: c.population,
        email: Boolean(c.mairieEmail),
        publies: s?.publies ?? 0,
        aTraiter: s?.aTraiter ?? 0,
        chantiers: s?.chantiers ?? 0,
        demande: s?.derniereDemande ? { statut: s.derniereDemande.statut as keyof typeof STATUT_DEMANDE, annee: s.derniereDemande.annee } : null,
      };
    })
    // Les communes actives (documents, demandes) d'abord
    .sort((a, b) => b.publies + b.aTraiter + (b.demande ? 1 : 0) - (a.publies + a.aTraiter + (a.demande ? 1 : 0)) || a.nom.localeCompare(b.nom, "fr"));

  return (
    <section className="section">
      <div className="conteneur">
        <p className="petit">
          <Link href="/admin/regions">Territoires</Link> › <Link href={`/admin/regions/${dep.region.code}`}>{dep.region.nom}</Link> › {dep.nom}
        </p>
        <div className="bloc-titre">
          <h1 style={{ margin: 0 }}>
            {dep.nom} <span className="discret">({dep.code})</span>
          </h1>
          <Link href={`/departements/${dep.code}`} className="bouton">
            Page publique
          </Link>
        </div>
        {dep.communes.length === 0 ? (
          <div className="vide">
            <strong>Aucune commune importée.</strong> Couvrez ce département depuis la page de sa{" "}
            <Link href={`/admin/regions/${dep.region.code}`}>région</Link>.
          </div>
        ) : (
          <>
            <details className="carte admin-depliable" style={{ marginBottom: 16 }}>
              <summary>
                <strong>Demandes {annee} en lot</strong>{" "}
                <span className="discret petit">
                  · {aPreparer} commune{aPreparer > 1 ? "s" : ""} à préparer · {aProgrammer} brouillon{aProgrammer > 1 ? "s" : ""} à programmer
                </span>
              </summary>
              <div className="grille-champs" style={{ alignItems: "start", marginTop: 12 }}>
                <FormulaireAction
                  action={preparerDemandesLot}
                  confirmation={`Préparer ${aPreparer} brouillon(s) de demande ${annee} ? Rien n'est envoyé à cette étape.`}
                >
                  <input type="hidden" name="departement" value={dep.code} />
                  <input type="hidden" name="annee" value={annee} />
                  <h3 className="titre-carte">1. Préparer les brouillons</h3>
                  <p className="petit">
                    Un brouillon par commune qui a un courriel de mairie et pas encore de demande {annee}. Pièces par défaut&nbsp;: liste complète
                    sous 3&nbsp;500 habitants, liste ciblée au-delà (état des mandats, indemnités, frais, subventions).
                  </p>
                  <label className="champ">
                    <span>Exercice demandé</span>
                    <input name="exercice" inputMode="numeric" defaultValue={annee - 1} required />
                  </label>
                  <button type="submit" className="bouton" disabled={aPreparer === 0}>
                    Préparer {aPreparer} brouillon{aPreparer > 1 ? "s" : ""}
                  </button>
                </FormulaireAction>
                <FormulaireAction
                  action={programmerDemandesLot}
                  confirmation={`Programmer l'envoi de ${aProgrammer} demande(s) aux mairies ? Les envois seront étalés ; chacun reste annulable jusqu'à son heure.`}
                >
                  <input type="hidden" name="departement" value={dep.code} />
                  <input type="hidden" name="annee" value={annee} />
                  <h3 className="titre-carte">2. Programmer les envois</h3>
                  <p className="petit">
                    Les brouillons non programmés partent à la suite, étalés pour ménager le relais de messagerie. Chacun reste modifiable et
                    annulable depuis la fiche de sa commune.
                  </p>
                  <div className="grille-champs">
                    <label className="champ">
                      <span>Premier envoi (heure de Paris)</span>
                      <input type="datetime-local" name="debut" defaultValue={proposition} required />
                    </label>
                    <label className="champ">
                      <span>Envois par heure</span>
                      <input name="parHeure" inputMode="numeric" defaultValue={10} required />
                    </label>
                  </div>
                  <label className="case">
                    <input type="checkbox" name="confirmation" value="oui" required /> J&apos;ai relu les courriers et je confirme les envois
                  </label>
                  <button type="submit" className="bouton bouton-principal" disabled={aProgrammer === 0}>
                    Programmer {aProgrammer} envoi{aProgrammer > 1 ? "s" : ""}
                  </button>
                </FormulaireAction>
              </div>
            </details>
            <TableCommunes communes={lignes} />
          </>
        )}
      </div>
    </section>
  );
}
