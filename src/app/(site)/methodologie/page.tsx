import type { Metadata } from "next";
import { EnTetePage } from "@/components/EnTetePage";

export const metadata: Metadata = { title: "Méthodologie et sources" };

export default function Methodologie() {
  return (
    <>
      <EnTetePage
        ariane={[{ libelle: "Méthodologie" }]}
        surtitre="Méthodologie"
        titre={<>D&apos;où viennent les chiffres</>}
        chapo={
          <>
            La plateforme combine deux sources : les données financières déjà publiées en open data, et les documents que
          nous demandons directement aux mairies.
          </>
        }
      />
      <section className="section">
        <div className="conteneur page-avec-sommaire">
          <nav className="sommaire" aria-labelledby="titre-sommaire">
            <h2 id="titre-sommaire">Sommaire</h2>
            <ol>
              <li>
                <a href="#sources">Sources</a>
              </li>
              <li>
                <a href="#definitions">Définitions des indicateurs</a>
              </li>
              <li>
                <a href="#cadre-juridique">Cadre juridique</a>
              </li>
              <li>
                <a href="#occultation">Comment nous occultons</a>
              </li>
              <li>
                <a href="#erreurs">Signaler une erreur</a>
              </li>
            </ol>
          </nav>
          <div className="prose">

            <h2 id="sources">Sources</h2>
            <dl>
              <dt>Comptes des communes</dt>
              <dd>
                Observatoire des finances et de la gestion publique locales (OFGL), jeu « ofgl-base-communes ». Agrégats
                calculés à partir des balances comptables de la DGFiP. Nous utilisons le budget principal ; les budgets annexes
                (eau, assainissement…) sont importés séparément.
              </dd>
              <dt>Référentiel géographique</dt>
              <dd>API Découpage administratif (geo.api.gouv.fr) : régions, départements, communes, populations légales.</dd>
              <dt>Coordonnées des mairies</dt>
              <dd>Annuaire de l&apos;administration (service-public.fr), utilisé pour adresser les demandes.</dd>
              <dt>Documents des mairies</dt>
              <dd>
                Obtenus par demande de communication de documents administratifs (voir le cadre juridique ci-dessous), puis
                occultés avant publication.
              </dd>
            </dl>

            <h2 id="definitions">Définitions des indicateurs</h2>
            <dl>
              <dt>Dépenses totales</dt>
              <dd>Dépenses de fonctionnement et d&apos;investissement, hors remboursement du capital des emprunts.</dd>
              <dt>Recettes totales</dt>
              <dd>Recettes de fonctionnement et d&apos;investissement, hors nouveaux emprunts.</dd>
              <dt>Épargne brute</dt>
              <dd>
                Recettes de fonctionnement moins dépenses de fonctionnement. C&apos;est ce qui reste à la commune, chaque
                année, pour rembourser sa dette et investir.
              </dd>
              <dt>Encours de dette</dt>
              <dd>Capital restant dû au 31 décembre de l&apos;exercice.</dd>
              <dt>Dépenses d&apos;équipement</dt>
              <dd>Travaux, acquisitions de bâtiments, de terrains, de véhicules ou de matériel.</dd>
              <dt>Montants par habitant</dt>
              <dd>Montant divisé par la population totale de l&apos;exercice (définition INSEE).</dd>
              <dt>Comparaison aux communes de même taille</dt>
              <dd>
                Chaque commune est comparée à la <strong>médiane nationale</strong> des communes de sa strate de population
                (par exemple 500 à 1 999 habitants). La médiane est moins sensible que la moyenne aux quelques communes aux
                comptes atypiques. Un écart n&apos;est pas un jugement : une commune touristique ou centre-bourg a
                naturellement des charges différentes.
              </dd>
            </dl>

            <h2 id="cadre-juridique">Cadre juridique</h2>
            <h3>Obtenir les documents</h3>
            <ul>
              <li>
                Toute personne peut obtenir communication des documents administratifs détenus par une administration, sans
                avoir à justifier de motif (art. L.300-1 et L.311-1 du Code des relations entre le public et
                l&apos;administration, CRPA).
              </li>
              <li>La communication peut se faire par courrier électronique, sans frais (art. L.311-9).</li>
              <li>
                Le silence gardé pendant un mois vaut refus (art. R.311-13). La Commission d&apos;accès aux documents
                administratifs (CADA) peut alors être saisie dans les deux mois (art. R.343-1).
              </li>
              <li>
                Pour ne pas surcharger les petites mairies, nous envoyons <strong>une seule demande groupée par commune et
                par an</strong>. L&apos;administration n&apos;est pas tenue de répondre aux demandes abusives par leur nombre ou
                leur caractère répétitif (art. L.311-2).
              </li>
              <li>
                Les communes établissent chaque année un état des indemnités perçues par leurs élus (art. L.2123-24-1-1 du
                Code général des collectivités territoriales).
              </li>
            </ul>
            <h3>Publier les documents</h3>
            <ul>
              <li>
                Les informations publiques figurant dans les documents communiqués peuvent être réutilisées librement et
                gratuitement (art. L.321-1 et L.324-1).
              </li>
              <li>
                Les mentions protégées par la loi sont occultées avant publication (art. L.311-6 et L.311-7) : vie privée,
                coordonnées personnelles, données bancaires, signatures, appréciations portées sur une personne, secret des
                affaires.
              </li>
              <li>
                Les données personnelles sont soumises à l&apos;article L.322-2 et au RGPD. C&apos;est pourquoi les
                indemnités et les frais sont publiés <strong>par fonction</strong> (maire, adjoints…), sans le nom des
                élus.
              </li>
            </ul>

            <h2 id="occultation">Comment nous occultons</h2>
            <ol>
              <li>Le document original est chiffré dès réception et n&apos;est jamais publié.</li>
              <li>
                Une détection automatique repère les mentions sensibles (IBAN, numéros de téléphone, adresses
                électroniques…). Chaque zone est ensuite vérifiée et complétée à la main.
              </li>
              <li>
                Les pages sont converties en images, les zones sont noircies, puis le PDF est reconstruit. Aucun texte ne
                subsiste sous les zones masquées.
              </li>
            </ol>

            <h2 id="erreurs">Signaler une erreur</h2>
            <p>
              Une donnée vous semble fausse, ou une mention aurait dû être occultée ? Écrivez-nous depuis la page{" "}
              <a href="/a-propos#contact">À propos</a> : nous corrigeons ou retirons le document au plus vite.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
