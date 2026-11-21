import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ajouterMessage,
  annulerEnvoiProgramme,
  creerDemande,
  debloquerEnvoi,
  enregistrerChantier,
  enregistrerFrais,
  enregistrerIndemnite,
  enregistrerSaisineCada,
  envoyerDemande,
  envoyerRelance,
  marquerEnvoyee,
  modifierCommune,
  modifierDemande,
  rattacherDocumentsDemande,
  supprimerChantier,
  supprimerDemande,
  supprimerFrais,
  supprimerIndemnite,
} from "@/app/admin/actions";
import { FormulaireAction } from "@/components/admin/FormulaireAction";
import { OngletActifVisible } from "@/components/admin/OngletActifVisible";
import { site } from "@/lib/config";
import { db } from "@/lib/db";
import {
  courrierRelance,
  courrierSaisineCada,
  formatJourParis,
  LIBELLES_PIECES,
  PIECES,
  piecesParDefaut,
  SEUIL_GRANDE_COMMUNE,
  situationDemande,
  statutAffiche,
} from "@/lib/demande";
import { formatDateCourte, formatEntier, formatEuros } from "@/lib/format";
import { formatDateHeure, formatDateHeureCourte, versHeureParis } from "@/lib/heure";
import { CATEGORIE_DOCUMENT, STATUT_DEMANDE, STATUT_DOCUMENT } from "@/lib/statuts";
import { libelleStrate } from "@/lib/strates";
import { verifierAdminPage } from "@/lib/admin";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ onglet?: string; cree?: string }> };

const ONGLETS = [
  { id: "infos", libelle: "Informations" },
  { id: "chantiers", libelle: "Chantiers" },
  { id: "documents", libelle: "Documents" },
  { id: "elus", libelle: "Élus" },
  { id: "demandes", libelle: "Demandes CRPA / CADA" },
] as const;

const CATEGORIES_CHANTIER = ["Voirie", "Bâtiments communaux", "Bâtiments scolaires", "Équipements sportifs", "Éclairage public", "Logements", "Réseaux", "Espaces verts", "Études", "Autre"];
const FONCTIONS = ["Maire", "1er adjoint", "2e adjoint", "3e adjoint", "4e adjoint", "5e adjoint", "Conseiller délégué", "Conseiller municipal"];
const NATURES_FRAIS = ["Déplacement", "Mission", "Représentation", "Formation", "Repas", "Autre"];
const STATUTS = Object.keys(STATUT_DEMANDE) as (keyof typeof STATUT_DEMANDE)[];

const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const nombre = (d: { toString(): string } | null) => (d === null ? "" : d.toString().replace(".", ","));

export default async function AdminCommune({ params, searchParams }: Props) {
  await verifierAdminPage(); // défense en profondeur (en plus du proxy et du layout)
  const { code } = await params;
  const { onglet: ongletDemande, cree } = await searchParams;
  const onglet = ONGLETS.find((o) => o.id === ongletDemande)?.id ?? "infos";
  const commune = await db.commune.findUnique({ where: { code }, include: { departement: { include: { region: true } } } });
  if (!commune) notFound();

  const [documents, chantiers, indemnites, frais, demandes] = await Promise.all([
    db.document.findMany({
      where: { communeCode: code },
      orderBy: [{ categorie: "asc" }, { titre: "asc" }],
      select: { id: true, titre: true, categorie: true, statut: true, dateDocument: true, montantTTC: true, operationId: true, demandeId: true, copie: true },
    }),
    db.operation.findMany({ where: { communeCode: code }, orderBy: { intitule: "asc" } }),
    db.indemniteFonction.findMany({ where: { communeCode: code }, orderBy: [{ annee: "desc" }, { ordre: "asc" }] }),
    db.fraisFonction.findMany({ where: { communeCode: code }, orderBy: [{ annee: "desc" }, { date: "desc" }] }),
    db.demande.findMany({ where: { communeCode: code }, orderBy: { annee: "desc" }, include: { messages: { orderBy: { date: "asc" } }, _count: { select: { documents: true } } } }),
  ]);
  const nomChantier = new Map(chantiers.map((c) => [c.id, c.intitule]));
  // Proposition d'heure d'envoi : prochain jour ouvré à 9 h (heure de Paris)
  const prochainEnvoi = (() => {
    for (let j = 1; j <= 7; j++) {
      const jourParis = versHeureParis(new Date(Date.now() + j * 86_400_000)).slice(0, 10);
      const semaine = new Date(`${jourParis}T12:00:00Z`).getUTCDay();
      if (semaine !== 0 && semaine !== 6) return `${jourParis}T09:00`;
    }
    return "";
  })();
  const anneeCourante = new Date().getFullYear();

  return (
    <section className="section">
      <div className="conteneur">
        <p className="petit">
          <Link href="/admin/regions">Territoires</Link> › <Link href={`/admin/regions/${commune.departement.region.code}`}>{commune.departement.region.nom}</Link> ›{" "}
          <Link href={`/admin/departements/${commune.departementCode}`}>{commune.departement.nom}</Link> › {commune.nom}
        </p>
        <div className="bloc-titre">
          <h1 style={{ margin: 0 }}>{commune.nom}</h1>
          <div className="boutons">
            <Link href={`/admin/depot?commune=${code}`} className="bouton">
              Déposer des documents
            </Link>
            <Link href={`/communes/${commune.slug}`} className="bouton" target="_blank">
              Fiche publique ↗
            </Link>
          </div>
        </div>

        <OngletActifVisible />
        <nav className="onglets" aria-label="Sections">
          {ONGLETS.map((o) => (
            <Link key={o.id} href={`/admin/communes/${code}?onglet=${o.id}`} aria-current={onglet === o.id ? "page" : undefined}>
              {o.libelle}
              {o.id === "chantiers" && <span className="puce-compte"> {chantiers.length}</span>}
              {o.id === "documents" && <span className="puce-compte"> {documents.length}</span>}
              {o.id === "demandes" && <span className="puce-compte"> {demandes.length}</span>}
            </Link>
          ))}
        </nav>

        {/* ─────────────── Informations ─────────────── */}
        {onglet === "infos" && (
          <div className="admin-grille">
            <FormulaireAction action={modifierCommune} className="carte">
              <h2 className="titre-carte">Fiche de la commune</h2>
              <input type="hidden" name="code" value={code} />
              <div className="grille-champs">
                <label className="champ">
                  <span>Adresse de la mairie</span>
                  <input name="mairieAdresse" defaultValue={commune.mairieAdresse ?? ""} maxLength={300} />
                </label>
                <label className="champ">
                  <span>Téléphone</span>
                  <input name="mairieTelephone" defaultValue={commune.mairieTelephone ?? ""} maxLength={40} />
                </label>
                <label className="champ">
                  <span>Courriel (destinataire des demandes)</span>
                  <input name="mairieEmail" type="email" defaultValue={commune.mairieEmail ?? ""} maxLength={200} />
                </label>
                <label className="champ">
                  <span>Site internet</span>
                  <input name="mairieSite" type="url" defaultValue={commune.mairieSite ?? ""} maxLength={300} placeholder="https://" />
                </label>
              </div>
              <label className="champ">
                <span>Présentation publique (affichée sur la fiche)</span>
                <textarea name="presentation" rows={5} defaultValue={commune.presentation ?? ""} maxLength={5000} placeholder="Contexte utile à la lecture : particularités de la commune, réponse de la mairie, précisions sur les documents…" />
              </label>
              <label className="champ">
                <span>Notes internes (jamais publiées)</span>
                <textarea name="notesInternes" rows={5} defaultValue={commune.notesInternes ?? ""} maxLength={10000} />
              </label>
              <button type="submit" className="bouton bouton-principal">
                Enregistrer
              </button>
            </FormulaireAction>
            <div className="carte encadre-methode">
              <h2 className="titre-carte">Référentiel</h2>
              <dl className="dl-admin">
                <dt>Code INSEE</dt>
                <dd>{commune.code}</dd>
                <dt>Population</dt>
                <dd>{commune.population !== null ? `${formatEntier(commune.population)} habitants` : "—"}</dd>
                <dt>Strate</dt>
                <dd>{libelleStrate(commune.strate)}</dd>
                <dt>Intercommunalité</dt>
                <dd>{commune.epciNom ?? "—"}</dd>
                <dt>Codes postaux</dt>
                <dd>{commune.codesPostaux.join(", ") || "—"}</dd>
                <dt>SIREN</dt>
                <dd>{commune.siren ?? "—"}</dd>
              </dl>
              <p className="petit discret">
                Issus de geo.api.gouv.fr et de l&apos;OFGL, mis à jour par les imports. Les coordonnées de la mairie saisies ici ne sont
                jamais écrasées par l&apos;annuaire.
              </p>
            </div>
          </div>
        )}

        {/* ─────────────── Chantiers ─────────────── */}
        {onglet === "chantiers" && (
          <>
            <datalist id="categories-chantier">
              {CATEGORIES_CHANTIER.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {[...chantiers, null].map((c) => {
              const nbDocs = c ? documents.filter((d) => d.operationId === c.id).length : 0;
              return (
                <details key={c?.id ?? "nouveau"} className="carte admin-depliable" open={c === null && chantiers.length === 0}>
                  <summary>
                    {c ? (
                      <>
                        <strong>{c.intitule}</strong>
                        <span className="discret petit">
                          {" "}
                          · {c.categorie ?? "sans catégorie"} · {nbDocs} document{nbDocs > 1 ? "s" : ""}
                          {c.montantTTC !== null ? ` · ${formatEuros(Number(c.montantTTC))} TTC voté` : ""}
                        </span>
                      </>
                    ) : (
                      <strong>+ Nouveau chantier</strong>
                    )}
                  </summary>
                  <FormulaireAction action={enregistrerChantier}>
                    <input type="hidden" name="communeCode" value={code} />
                    <input type="hidden" name="id" value={c?.id ?? ""} />
                    <div className="grille-champs">
                      <label className="champ">
                        <span>Intitulé</span>
                        <input name="intitule" required minLength={3} maxLength={200} defaultValue={c?.intitule ?? ""} />
                      </label>
                      <label className="champ">
                        <span>Catégorie</span>
                        <input name="categorie" list="categories-chantier" maxLength={80} defaultValue={c?.categorie ?? ""} />
                      </label>
                      <label className="champ">
                        <span>Statut</span>
                        <select name="statut" defaultValue={c?.statut ?? "REALISEE"}>
                          <option value="PREVUE">Voté, à venir</option>
                          <option value="EN_COURS">En cours</option>
                          <option value="REALISEE">Réalisé</option>
                        </select>
                      </label>
                      <label className="champ">
                        <span>Lieu</span>
                        <input name="lieu" maxLength={300} defaultValue={c?.lieu ?? ""} />
                      </label>
                      <label className="champ">
                        <span>Entreprises (noms commerciaux)</span>
                        <input name="prestataire" maxLength={300} defaultValue={c?.prestataire ?? ""} />
                      </label>
                      <label className="champ">
                        <span>Année</span>
                        <input name="annee" inputMode="numeric" defaultValue={c?.annee ?? ""} />
                      </label>
                      <label className="champ">
                        <span>Montant voté ou commandé TTC (€)</span>
                        <input name="montantTTC" inputMode="decimal" defaultValue={c ? nombre(c.montantTTC) : ""} />
                      </label>
                      <label className="champ">
                        <span>Montant HT (€)</span>
                        <input name="montantHT" inputMode="decimal" defaultValue={c ? nombre(c.montantHT) : ""} />
                      </label>
                    </div>
                    <label className="champ">
                      <span>Description publique</span>
                      <textarea name="description" rows={4} maxLength={5000} defaultValue={c?.description ?? ""} />
                    </label>
                    <fieldset className="cases-documents">
                      <legend>Documents du chantier</legend>
                      {documents.map((d) => (
                        <label key={d.id} className="case">
                          <input type="checkbox" name="documents" value={d.id} defaultChecked={c !== null && d.operationId === c.id} />
                          <span>
                            <span className="type-doc">{CATEGORIE_DOCUMENT[d.categorie]}</span> {d.titre}
                            {d.operationId && (!c || d.operationId !== c.id) && <span className="discret petit"> (dans « {nomChantier.get(d.operationId)} »)</span>}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <button type="submit" className="bouton bouton-principal">
                      {c ? "Enregistrer le chantier" : "Créer le chantier"}
                    </button>
                  </FormulaireAction>
                  {c && (
                    <FormulaireAction action={supprimerChantier} confirmation={`Supprimer le chantier « ${c.intitule} » ? Ses documents sont conservés.`} className="formulaire-suppression">
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="bouton">
                        Supprimer le chantier
                      </button>
                    </FormulaireAction>
                  )}
                </details>
              );
            })}
          </>
        )}

        {/* ─────────────── Documents ─────────────── */}
        {onglet === "documents" && (
          <div className="carte tableau-defilant">
            {documents.length === 0 ? (
              <p>
                Aucun document. <Link href={`/admin/depot?commune=${code}`}>Déposer des documents</Link>
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th className="nombre">Montant TTC</th>
                    <th>Chantier</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link href={`/admin/documents/${d.id}`}>{d.titre}</Link>
                        {d.copie && <span className="discret petit"> · second exemplaire</span>}
                      </td>
                      <td>{CATEGORIE_DOCUMENT[d.categorie]}</td>
                      <td className="chiffres">{d.dateDocument ? formatDateCourte(d.dateDocument) : "—"}</td>
                      <td className="nombre">{d.montantTTC !== null ? formatEuros(Number(d.montantTTC)) : "—"}</td>
                      <td className="petit">{d.operationId ? nomChantier.get(d.operationId) : "—"}</td>
                      <td>
                        <span className={`badge ${STATUT_DOCUMENT[d.statut].classe}`}>{STATUT_DOCUMENT[d.statut].libelle}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ─────────────── Élus ─────────────── */}
        {onglet === "elus" && (
          <>
            <datalist id="fonctions">
              {FONCTIONS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <datalist id="natures">
              {NATURES_FRAIS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <p className="discret">Publiés par fonction uniquement : ne saisissez jamais le nom d&apos;un élu.</p>
            <h2 className="titre-section-admin">Indemnités de fonction</h2>
            {[...indemnites, null].map((i) => (
              <details key={i?.id ?? "nouvelle"} className="carte admin-depliable">
                <summary>
                  {i ? (
                    <>
                      <strong>
                        {i.annee} · {i.fonction}
                      </strong>
                      <span className="discret"> · {formatEuros(Number(i.montantBrutAnnuel))} brut annuel</span>
                    </>
                  ) : (
                    <strong>+ Ajouter une indemnité</strong>
                  )}
                </summary>
                <FormulaireAction action={enregistrerIndemnite}>
                  <input type="hidden" name="communeCode" value={code} />
                  <input type="hidden" name="id" value={i?.id ?? ""} />
                  <div className="grille-champs">
                    <label className="champ">
                      <span>Année</span>
                      <input name="annee" required inputMode="numeric" defaultValue={i?.annee ?? anneeCourante - 1} />
                    </label>
                    <label className="champ">
                      <span>Fonction</span>
                      <input name="fonction" required list="fonctions" maxLength={120} defaultValue={i?.fonction ?? ""} />
                    </label>
                    <label className="champ">
                      <span>Ordre d&apos;affichage</span>
                      <input name="ordre" inputMode="numeric" defaultValue={i?.ordre ?? 0} />
                    </label>
                    <label className="champ">
                      <span>Montant brut annuel (€)</span>
                      <input name="montantBrutAnnuel" required inputMode="decimal" defaultValue={i ? nombre(i.montantBrutAnnuel) : ""} />
                    </label>
                    <label className="champ">
                      <span>Document source</span>
                      <select name="documentId" defaultValue={i?.documentId ?? ""}>
                        <option value="">—</option>
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.titre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="bouton bouton-principal">
                    Enregistrer
                  </button>
                </FormulaireAction>
                {i && (
                  <FormulaireAction action={supprimerIndemnite} confirmation="Supprimer cette ligne ?" className="formulaire-suppression">
                    <input type="hidden" name="id" value={i.id} />
                    <button type="submit" className="bouton">
                      Supprimer
                    </button>
                  </FormulaireAction>
                )}
              </details>
            ))}

            <h2 className="titre-section-admin">Frais remboursés</h2>
            {[...frais, null].map((x) => (
              <details key={x?.id ?? "nouveaux"} className="carte admin-depliable">
                <summary>
                  {x ? (
                    <>
                      <strong>
                        {x.annee} · {x.fonction} · {x.nature}
                      </strong>
                      <span className="discret">
                        {" "}
                        · {formatEuros(Number(x.montant))}
                        {x.libelle ? ` · ${x.libelle}` : ""}
                      </span>
                    </>
                  ) : (
                    <strong>+ Ajouter des frais</strong>
                  )}
                </summary>
                <FormulaireAction action={enregistrerFrais}>
                  <input type="hidden" name="communeCode" value={code} />
                  <input type="hidden" name="id" value={x?.id ?? ""} />
                  <div className="grille-champs">
                    <label className="champ">
                      <span>Année</span>
                      <input name="annee" required inputMode="numeric" defaultValue={x?.annee ?? anneeCourante - 1} />
                    </label>
                    <label className="champ">
                      <span>Fonction</span>
                      <input name="fonction" required list="fonctions" maxLength={120} defaultValue={x?.fonction ?? ""} />
                    </label>
                    <label className="champ">
                      <span>Nature</span>
                      <input name="nature" required list="natures" maxLength={120} defaultValue={x?.nature ?? ""} />
                    </label>
                    <label className="champ">
                      <span>Libellé</span>
                      <input name="libelle" maxLength={300} defaultValue={x?.libelle ?? ""} />
                    </label>
                    <label className="champ">
                      <span>Date</span>
                      <input name="date" type="date" defaultValue={x ? jour(x.date) : ""} />
                    </label>
                    <label className="champ">
                      <span>Montant (€)</span>
                      <input name="montant" required inputMode="decimal" defaultValue={x ? nombre(x.montant) : ""} />
                    </label>
                    <label className="champ">
                      <span>Document source</span>
                      <select name="documentId" defaultValue={x?.documentId ?? ""}>
                        <option value="">—</option>
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.titre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="bouton bouton-principal">
                    Enregistrer
                  </button>
                </FormulaireAction>
                {x && (
                  <FormulaireAction action={supprimerFrais} confirmation="Supprimer cette ligne ?" className="formulaire-suppression">
                    <input type="hidden" name="id" value={x.id} />
                    <button type="submit" className="bouton">
                      Supprimer
                    </button>
                  </FormulaireAction>
                )}
              </details>
            ))}
          </>
        )}

        {/* ─────────────── Demandes CRPA / CADA ─────────────── */}
        {onglet === "demandes" && (
          <>
            {cree && demandes.some((d) => d.id === cree) && (
              <p className="alerte alerte-info" role="status">
                Brouillon créé : relisez le courrier ci-dessous avant de l&apos;envoyer ou de le programmer.
              </p>
            )}
            {demandes.map((d) => {
              const statut = statutAffiche(d) ?? STATUT_DEMANDE[d.statut];
              const alerte = situationDemande(d);
              const envoyee = d.statut !== "BROUILLON" || d.envoyeeLe !== null;
              // Envoi bloqué : réservation posée depuis plus de 10 minutes, ou état incertain signalé.
              const envoiIncertain =
                d.statut === "BROUILLON" && d.envoiEnCoursLe !== null && (Date.now() - d.envoiEnCoursLe.getTime() > 10 * 60_000 || !!d.erreurEnvoi);
              const sansReponse = ["ENVOYEE", "RELANCEE", "REFUS_IMPLICITE"].includes(d.statut);
              const aSaisirCada =
                (d.statut === "REFUS_IMPLICITE" || d.statut === "REFUS_EXPRES" || (sansReponse && d.echeanceReponse && d.echeanceReponse.getTime() < Date.now())) &&
                !d.cadaSaisieLe;
              return (
                <article key={d.id} id={`demande-${d.id}`} className="carte demande-admin">
                  <header className="bloc-titre" style={{ marginBottom: 8 }}>
                    <h2 className="titre-carte" style={{ margin: 0 }}>
                      Demande {d.annee}
                    </h2>
                    <span className={`badge ${statut.classe}`}>{statut.libelle}</span>
                  </header>
                  {alerte && <p className={`alerte alerte-${alerte.niveau}`}>{alerte.texte}</p>}
                  <dl className="dl-admin dl-ligne">
                    <dt>Envoyée le</dt>
                    <dd>{d.envoyeeLe ? formatDateHeureCourte(d.envoyeeLe) : "—"}</dd>
                    <dt>Réponse attendue au plus tard le</dt>
                    <dd>{d.echeanceReponse ? formatJourParis(d.echeanceReponse) : "—"}</dd>
                    <dt>Saisine de la CADA au plus tard le</dt>
                    <dd>{d.limiteSaisineCada ? formatJourParis(d.limiteSaisineCada) : "—"}</dd>
                    <dt>Documents reçus</dt>
                    <dd>{d._count.documents}</dd>
                  </dl>

                  {envoiIncertain && (
                    <div className="encadre-envoi encadre-alerte">
                      <p>
                        <strong>Envoi bloqué depuis le {formatDateHeureCourte(d.envoiEnCoursLe!)}.</strong> Le courriel est peut-être parti. Avant toute action,
                        vérifiez la copie cachée dans la boîte de l&apos;association{site.asso.email ? ` (${site.asso.email})` : ""}.
                      </p>
                      <div className="envoi-boutons">
                        <FormulaireAction action={marquerEnvoyee} confirmation="Marquer la demande comme envoyée ?">
                          <input type="hidden" name="id" value={d.id} />
                          <label className="case">
                            <input type="checkbox" name="verifie" value="oui" required /> J&apos;ai vérifié : le courriel <strong>est parti</strong>
                          </label>
                          <button type="submit" className="bouton bouton-principal">
                            Marquer comme envoyée
                          </button>
                        </FormulaireAction>
                        <FormulaireAction action={debloquerEnvoi} confirmation="Débloquer l'envoi ? La demande pourra être renvoyée.">
                          <input type="hidden" name="id" value={d.id} />
                          <label className="case">
                            <input type="checkbox" name="verifie" value="oui" required /> J&apos;ai vérifié : le courriel <strong>n&apos;est pas parti</strong>
                          </label>
                          <button type="submit" className="bouton">
                            Débloquer l&apos;envoi
                          </button>
                        </FormulaireAction>
                      </div>
                    </div>
                  )}

                  {d.statut === "BROUILLON" && d.envoiProgrammeLe && (
                    <div className="encadre-envoi">
                      <p>
                        <strong>Envoi programmé le {formatDateHeure(d.envoiProgrammeLe)}</strong> (heure de Paris) à <code>{d.destinataire}</code>
                        {d.envoiCopieCachee && site.asso.email ? `, copie cachée à ${site.asso.email}` : ""}.
                      </p>
                      <p className="petit discret">C&apos;est la version du courrier enregistrée au moment de l&apos;envoi qui partira.</p>
                      <FormulaireAction action={annulerEnvoiProgramme} confirmation="Annuler l'envoi programmé ? La demande restera en brouillon.">
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" className="bouton">
                          Annuler la programmation
                        </button>
                      </FormulaireAction>
                    </div>
                  )}

                  {d.statut === "BROUILLON" && !d.envoiProgrammeLe && !d.envoiEnCoursLe && (
                    <FormulaireAction action={envoyerDemande} className="encadre-envoi">
                      <input type="hidden" name="id" value={d.id} />
                      <p>
                        <strong>Envoi par courriel</strong> à <code>{d.destinataire || "aucun destinataire : complétez-le ci-dessous"}</code>, depuis{" "}
                        <code>{process.env.SMTP_FROM}</code>.
                      </p>
                      <div className="apercu-courrier" tabIndex={0} aria-label="Courrier qui sera envoyé">
                        <p>
                          <strong>Objet :</strong> {d.objet}
                        </p>
                        <pre className="texte-courrier">{d.corps}</pre>
                      </div>
                      <label className="case">
                        <input type="checkbox" name="confirmation" value="oui" required /> J&apos;ai relu le courrier ci-dessus et je confirme l&apos;envoi
                      </label>
                      {site.asso.email && (
                        <label className="case">
                          <input type="checkbox" name="copie" value="oui" defaultChecked={d.envoiCopieCachee} /> Copie cachée à {site.asso.email}
                        </label>
                      )}
                      <div className="envoi-boutons">
                        <button
                          type="submit"
                          name="mode"
                          value="maintenant"
                          className="bouton bouton-principal"
                          disabled={!d.destinataire}
                          data-confirmation={`Envoyer la demande MAINTENANT à ${d.destinataire} ?`}
                        >
                          Envoyer maintenant
                        </button>
                        <span className="discret">ou</span>
                        <label className="champ champ-en-ligne">
                          <span className="sr-only">Date et heure d&apos;envoi (heure de Paris)</span>
                          <input type="datetime-local" name="quand" defaultValue={prochainEnvoi} min={versHeureParis(new Date(Date.now() + 5 * 60_000))} />
                        </label>
                        <button
                          type="submit"
                          name="mode"
                          value="programmer"
                          className="bouton"
                          disabled={!d.destinataire}
                          data-confirmation={`Programmer l'envoi de la demande à ${d.destinataire} à la date choisie (heure de Paris) ?`}
                        >
                          Programmer l&apos;envoi
                        </button>
                      </div>
                      <p className="petit discret" style={{ margin: "6px 0 0" }}>
                        Heure de Paris. Un envoi programmé peut être annulé jusqu&apos;au dernier moment.
                      </p>
                    </FormulaireAction>
                  )}

                  {sansReponse && d.destinataire && (
                    <details className="admin-depliable-interne">
                      <summary>Préparer une relance</summary>
                      <FormulaireAction action={envoyerRelance} confirmation={`Envoyer la relance à ${d.destinataire} ?`}>
                        <input type="hidden" name="id" value={d.id} />
                        <p className="petit discret">
                          Envoyée à <code>{d.destinataire}</code> par le même relais que la demande
                          {d.envoiCopieCachee && site.asso.email ? `, copie cachée à ${site.asso.email}` : ""}. Objet : « Relance — {d.objet} ».
                          {d.relanceeLe ? ` Dernière relance le ${formatDateHeureCourte(d.relanceeLe)}.` : ""}
                        </p>
                        <label className="champ">
                          <span>Texte de la relance (modifiable)</span>
                          <textarea name="corps" rows={14} required defaultValue={courrierRelance(d)} className="texte-courrier" />
                        </label>
                        <label className="case">
                          <input type="checkbox" name="confirmation" value="oui" required /> J&apos;ai relu la relance et je confirme l&apos;envoi
                        </label>
                        <button type="submit" className="bouton bouton-principal">
                          Envoyer la relance
                        </button>
                      </FormulaireAction>
                    </details>
                  )}

                  {(aSaisirCada || d.statut === "CADA_SAISIE") && (
                    <details className="admin-depliable-interne" open={!!aSaisirCada && !d.cadaSaisieLe}>
                      <summary>Saisine de la CADA</summary>
                      {!d.cadaSaisieLe && (
                        <>
                          <p className="petit">
                            La saisine se fait en ligne sur{" "}
                            <a href="https://www.cada.fr" target="_blank" rel="noopener noreferrer">
                              cada.fr
                            </a>{" "}
                            (formulaire de saisine) ou par courrier, avec une copie de la demande initiale. Texte prêt à copier :
                          </p>
                          <textarea readOnly rows={14} className="texte-courrier" defaultValue={courrierSaisineCada(d, commune)} aria-label="Texte de la saisine de la CADA" />
                        </>
                      )}
                      <FormulaireAction action={enregistrerSaisineCada}>
                        <input type="hidden" name="id" value={d.id} />
                        <div className="grille-champs">
                          <label className="champ">
                            <span>CADA saisie le</span>
                            <input name="date" type="date" required defaultValue={jour(d.cadaSaisieLe ?? new Date())} />
                          </label>
                          <label className="champ">
                            <span>N° de dossier CADA (si connu)</span>
                            <input name="numeroCada" defaultValue={d.numeroCada ?? ""} maxLength={60} />
                          </label>
                        </div>
                        <button type="submit" className="bouton">
                          {d.cadaSaisieLe ? "Mettre à jour la saisine" : "J'ai saisi la CADA"}
                        </button>
                      </FormulaireAction>
                    </details>
                  )}

                  <details className="admin-depliable-interne">
                    <summary>Courrier, statut et dates</summary>
                    <FormulaireAction action={modifierDemande}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="majLe" value={d.majLe.toISOString()} />
                      <div className="grille-champs">
                        <label className="champ">
                          <span>Destinataire</span>
                          <input name="destinataire" type="email" defaultValue={d.destinataire} maxLength={200} />
                        </label>
                        <label className="champ">
                          <span>Statut</span>
                          <select name="statut" defaultValue={d.statut}>
                            {STATUTS.filter((s) => !(envoyee && s === "BROUILLON")).map((s) => (
                              <option key={s} value={s}>
                                {STATUT_DEMANDE[s].libelle}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="champ">
                        <span>Objet</span>
                        <input name="objet" required defaultValue={d.objet} maxLength={300} />
                      </label>
                      <label className="champ">
                        <span>Courrier</span>
                        <textarea name="corps" rows={16} required defaultValue={d.corps} className="texte-courrier" />
                      </label>
                      <div className="grille-champs">
                        <label className="champ">
                          <span>Envoyée le</span>
                          <input name="envoyeeLe" type="date" defaultValue={jour(d.envoyeeLe)} />
                        </label>
                        <label className="champ">
                          <span>Relancée le</span>
                          <input name="relanceeLe" type="date" defaultValue={jour(d.relanceeLe)} />
                        </label>
                        <label className="champ">
                          <span>Réponse reçue le</span>
                          <input name="reponseLe" type="date" defaultValue={jour(d.reponseLe)} />
                        </label>
                        <label className="champ">
                          <span>CADA saisie le</span>
                          <input name="cadaSaisieLe" type="date" defaultValue={jour(d.cadaSaisieLe)} />
                        </label>
                        <label className="champ">
                          <span>N° de dossier CADA</span>
                          <input name="numeroCada" defaultValue={d.numeroCada ?? ""} maxLength={60} />
                        </label>
                        <label className="champ">
                          <span>Avis de la CADA le</span>
                          <input name="avisCadaLe" type="date" defaultValue={jour(d.avisCadaLe)} />
                        </label>
                        <label className="champ">
                          <span>Sens de l&apos;avis</span>
                          <input name="avisCada" defaultValue={d.avisCada ?? ""} maxLength={200} placeholder="favorable, défavorable…" />
                        </label>
                        <label className="champ">
                          <span>Clôturée le</span>
                          <input name="clotureLe" type="date" defaultValue={jour(d.clotureLe)} />
                        </label>
                      </div>
                      <label className="champ">
                        <span>Notes internes</span>
                        <textarea name="notes" rows={3} defaultValue={d.notes ?? ""} />
                      </label>
                      <p className="petit discret">
                        L&apos;échéance de réponse (un mois) et la date limite de saisine de la CADA (deux mois après le refus) sont recalculées à
                        l&apos;enregistrement, au jour près (à défaut de quantième identique, le dernier jour du mois). Si la demande a changé depuis
                        l&apos;ouverture de la page (envoi programmé effectué…), l&apos;enregistrement est refusé : rechargez d&apos;abord.
                      </p>
                      <button type="submit" className="bouton bouton-principal">
                        Enregistrer
                      </button>
                    </FormulaireAction>
                    {!envoyee && !d.envoiEnCoursLe && (
                      <FormulaireAction action={supprimerDemande} confirmation="Supprimer ce brouillon ?" className="formulaire-suppression">
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" className="bouton">
                          Supprimer le brouillon
                        </button>
                      </FormulaireAction>
                    )}
                  </details>

                  <details className="admin-depliable-interne">
                    <summary>Journal des échanges ({d.messages.length})</summary>
                    <ol className="journal">
                      {d.messages.map((m) => (
                        <li key={m.id}>
                          <p className="petit">
                            <span className={`badge ${m.sens === "SORTANT" ? "badge-accent" : ""}`}>{m.sens === "SORTANT" ? "Envoyé" : "Reçu"}</span>{" "}
                            {formatDateCourte(m.date)} · {m.de} → {m.a}
                          </p>
                          <p>
                            <strong>{m.sujet}</strong>
                          </p>
                          {m.corps && <pre className="texte-courrier">{m.corps}</pre>}
                        </li>
                      ))}
                    </ol>
                    <FormulaireAction action={ajouterMessage}>
                      <input type="hidden" name="demandeId" value={d.id} />
                      <div className="grille-champs">
                        <label className="champ">
                          <span>Sens</span>
                          <select name="sens" defaultValue="ENTRANT">
                            <option value="ENTRANT">Reçu (mairie, CADA…)</option>
                            <option value="SORTANT">Envoyé hors plateforme (courrier postal…)</option>
                          </select>
                        </label>
                        <label className="champ">
                          <span>Date</span>
                          <input name="date" type="date" required defaultValue={jour(new Date())} />
                        </label>
                        <label className="champ">
                          <span>De</span>
                          <input name="de" required defaultValue={commune.mairieEmail ?? ""} maxLength={200} />
                        </label>
                        <label className="champ">
                          <span>À</span>
                          <input name="a" required defaultValue={process.env.SMTP_FROM ?? ""} maxLength={200} />
                        </label>
                      </div>
                      <label className="champ">
                        <span>Sujet</span>
                        <input name="sujet" required maxLength={300} />
                      </label>
                      <label className="champ">
                        <span>Contenu</span>
                        <textarea name="corps" rows={5} />
                      </label>
                      <button type="submit" className="bouton">
                        Ajouter au journal
                      </button>
                    </FormulaireAction>
                  </details>

                  <details className="admin-depliable-interne">
                    <summary>Documents reçus pour cette demande ({d._count.documents})</summary>
                    <FormulaireAction action={rattacherDocumentsDemande}>
                      <input type="hidden" name="id" value={d.id} />
                      <fieldset className="cases-documents">
                        <legend className="sr-only">Documents</legend>
                        {documents.map((doc) => (
                          <label key={doc.id} className="case">
                            <input type="checkbox" name="documents" value={doc.id} defaultChecked={doc.demandeId === d.id} />
                            <span>
                              <span className="type-doc">{CATEGORIE_DOCUMENT[doc.categorie]}</span> {doc.titre}
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <button type="submit" className="bouton">
                        Enregistrer le rattachement
                      </button>
                    </FormulaireAction>
                  </details>
                </article>
              );
            })}

            <details className="carte admin-depliable" open={demandes.length === 0}>
              <summary>
                <strong>+ Nouvelle demande</strong>
              </summary>
              {(() => {
                // Une demande par commune et par an : moins de 11 mois après la précédente, risque de demande « répétitive » (L.311-2).
                const derniere = demandes.find((x) => x.envoyeeLe);
                const recente = derniere?.envoyeeLe && Date.now() - derniere.envoyeeLe.getTime() < 335 * 86_400_000;
                return recente ? (
                  <p className="alerte alerte-attention">
                    La dernière demande a été envoyée le {formatJourParis(derniere!.envoyeeLe!)}, il y a moins de 11 mois. Une nouvelle demande aussi
                    rapprochée pourrait être jugée répétitive (art. L.311-2 du CRPA).
                  </p>
                ) : null;
              })()}
              <FormulaireAction action={creerDemande}>
                <input type="hidden" name="communeCode" value={code} />
                <div className="grille-champs">
                  <label className="champ">
                    <span>Année de la demande</span>
                    <input name="annee" required inputMode="numeric" defaultValue={anneeCourante} />
                  </label>
                  <label className="champ">
                    <span>Exercice demandé</span>
                    <input name="exercice" required inputMode="numeric" defaultValue={anneeCourante - 1} />
                  </label>
                </div>
                <fieldset className="cases-documents">
                  <legend>Pièces demandées</legend>
                  {(Object.keys(PIECES) as (keyof typeof PIECES)[]).map((p) => (
                    <label key={p} className="case">
                      <input type="checkbox" name="pieces" value={p} defaultChecked={piecesParDefaut(commune.population).includes(p)} /> {LIBELLES_PIECES[p]}
                    </label>
                  ))}
                </fieldset>
                {(commune.population ?? 0) >= SEUIL_GRANDE_COMMUNE && (
                  <p className="petit">
                    Commune de plus de {formatEntier(SEUIL_GRANDE_COMMUNE)} habitants : budgets, comptes et délibérations sont en principe déjà en ligne, et
                    « toutes les factures » représenteraient des milliers de pièces (risque de demande abusive). L&apos;état des mandats
                    d&apos;investissement permet ensuite de cibler les opérations significatives.
                  </p>
                )}
                <p className="petit discret">
                  Une seule demande groupée par commune et par an. Le courrier est généré en brouillon : vous le relisez avant tout envoi.
                  {commune.mairieEmail ? ` Destinataire : ${commune.mairieEmail}.` : " Aucune adresse de mairie : complétez-la dans l'onglet Informations."}
                </p>
                <button type="submit" className="bouton bouton-principal">
                  Préparer le brouillon
                </button>
              </FormulaireAction>
            </details>
          </>
        )}
      </div>
    </section>
  );
}
