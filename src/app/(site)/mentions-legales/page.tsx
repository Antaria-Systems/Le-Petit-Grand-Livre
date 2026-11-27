import type { Metadata } from "next";
import { ACompleter } from "@/components/ACompleter";
import { EnTetePage } from "@/components/EnTetePage";
import { site } from "@/lib/config";
import { metadonnees } from "@/lib/seo";

export const metadata: Metadata = metadonnees({
  titre: "Mentions légales et données personnelles",
  description: `Éditeur, hébergement, licences et protection des données personnelles sur ${site.nom}.`,
  chemin: "/mentions-legales",
});

const SECTIONS = [
  ["editeur", "Éditeur"],
  ["hebergement", "Hébergement"],
  ["nature-du-site", "Nature du site"],
  ["licences", "Licences et crédits"],
  ["donnees-personnelles", "Données personnelles"],
  ["cookies", "Cookies"],
  ["droit-de-reponse", "Droit de réponse et rectification"],
] as const;

export default function MentionsLegales() {
  const contact = <ACompleter valeur={site.asso.email} libelle="adresse électronique" />;
  return (
    <>
      <EnTetePage ariane={[{ libelle: "Mentions légales" }]} titre={<>Mentions légales</>} />
      <section className="section">
        <div className="conteneur page-avec-sommaire">
          <nav className="sommaire" aria-labelledby="titre-sommaire">
            <h2 id="titre-sommaire">Sommaire</h2>
            <ol>
              {SECTIONS.map(([id, libelle]) => (
                <li key={id}>
                  <a href={`#${id}`}>{libelle}</a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="prose">
            <h2 id="editeur">Éditeur</h2>
            <p>
              Association <ACompleter valeur={site.asso.nom} libelle="nom" />, association loi 1901
              <br />
              RNA&nbsp;: <ACompleter valeur={site.asso.rna} libelle="numéro RNA" />
              {site.asso.siren && <> · SIREN&nbsp;: {site.asso.siren}</>}
              <br />
              Siège&nbsp;: <ACompleter valeur={site.asso.adresse} libelle="adresse du siège" />
              <br />
              Téléphone&nbsp;: <ACompleter valeur={site.asso.telephone} libelle="numéro de téléphone" />
              <br />
              Courriel&nbsp;: {contact}
            </p>
            <p>
              Directeur ou directrice de la publication&nbsp;: <ACompleter valeur={site.directeurPublication} libelle="nom" />
            </p>

            <h2 id="hebergement">Hébergement</h2>
            <p>
              <ACompleter valeur={site.hebergeur} libelle="hébergeur (nom, adresse, téléphone)" />
              <br />
              Serveurs administrés par l&apos;association {site.asso.nom} (coordonnées ci-dessus).
            </p>

            <h2 id="nature-du-site">Nature du site</h2>
            <p>
              Ce site est édité par une association indépendante. Il n&apos;est pas un site de l&apos;État, d&apos;une administration ni
              d&apos;une collectivité territoriale. Les documents publiés sont des copies occultées de documents administratifs&nbsp;: elles
              ne valent pas original.
            </p>

            <h2 id="licences">Licences et crédits</h2>
            <p>
              Le code source est distribué sous licence GNU AGPL-3.0
              {site.codeSource ? (
                <>
                  {" "}
                  et disponible à l&apos;adresse <a href={site.codeSource}>{site.codeSource}</a>
                </>
              ) : (
                <> et peut être obtenu sur simple demande à {contact}</>
              )}
              . Les données publiées sont réutilisables selon les termes de la{" "}
              <a href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/">Licence Ouverte 2.0</a> (Etalab), en mentionnant la source et
              la date de mise à jour. Les documents reproduits restent soumis, le cas échéant, aux droits de leurs auteurs (plans, études,
              photographies).
            </p>
            <p>
              Sources des données&nbsp;: comptes des communes de l&apos;Observatoire des finances et de la gestion publique locales (OFGL),
              référentiel géographique et contours des communes (geo.api.gouv.fr, d&apos;après l&apos;IGN), coordonnées des mairies
              (Annuaire de l&apos;administration, service-public.fr), documents communiqués par les mairies. Police de caractères&nbsp;:
              Public Sans (licence SIL Open Font).
            </p>

            <h2 id="donnees-personnelles">Données personnelles</h2>
            <dl className="definitions">
              <dt>Responsable du traitement</dt>
              <dd>
                Association {site.asso.nom}
                {site.asso.rna ? ` (RNA ${site.asso.rna})` : ""}, {site.asso.adresse} — {contact}.
              </dd>
              <dt>Finalité</dt>
              <dd>
                Informer le public sur les finances des communes, en publiant des données financières ouvertes et des documents
                administratifs obtenus au titre du code des relations entre le public et l&apos;administration (CRPA).
              </dd>
              <dt>Base légale</dt>
              <dd>
                Intérêt légitime de l&apos;association et du public à la transparence de l&apos;action publique locale (article 6.1.f du
                RGPD), dans le cadre du droit de réutilisation des informations publiques (articles L.321-1 et L.322-2 du CRPA).
              </dd>
              <dt>Données concernées</dt>
              <dd>
                Fonctions des élus et montants de leurs indemnités et frais&nbsp;; noms des élus figurant dans les délibérations, documents
                publics (article L.2121-26 du CGCT)&nbsp;; dénomination des entreprises, y compris d&apos;entrepreneurs individuels, et
                montants facturés&nbsp;; nom et fonction des agents qui correspondent avec l&apos;association. Les coordonnées personnelles,
                données bancaires, signatures et mentions relevant de la vie privée sont occultées avant publication.
              </dd>
              <dt>Sources</dt>
              <dd>Documents communiqués par les mairies&nbsp;; données de l&apos;OFGL, de geo.api.gouv.fr et de l&apos;Annuaire de l&apos;administration.</dd>
              <dt>Destinataires</dt>
              <dd>
                Le public, pour les documents occultés. Sous-traitants&nbsp;: Hetzner Online GmbH (hébergement, Allemagne)&nbsp;; Google
                (messagerie de l&apos;association, avec des transferts éventuels vers les États-Unis encadrés par le cadre de protection des
                données UE–États-Unis).
              </dd>
              <dt>Durées de conservation</dt>
              <dd>
                Documents publiés&nbsp;: tant qu&apos;ils sont utiles à l&apos;information du public, dix ans au plus après l&apos;exercice
                concerné. Originaux non occultés&nbsp;: conservés chiffrés cinq ans après leur publication, puis supprimés automatiquement.
                Correspondances avec les mairies&nbsp;: cinq ans.
              </dd>
              <dt>Vos droits</dt>
              <dd>
                Accès, rectification, effacement, limitation et opposition (articles 15 à 21 du RGPD), en écrivant à {contact}. Nous
                répondons dans un délai d&apos;un mois. Vous pouvez aussi introduire une réclamation auprès de la CNIL (
                <a href="https://www.cnil.fr">www.cnil.fr</a>).
              </dd>
            </dl>
            <p>
              Les personnes citées dans les documents ne sont pas informées individuellement, ce qui exigerait des efforts disproportionnés
              (article 14.5.b du RGPD)&nbsp;: la présente notice en tient lieu. Si vous estimez qu&apos;un document publié contient des
              données personnelles vous concernant, écrivez-nous&nbsp;: nous l&apos;occultons ou le retirons au plus vite.
            </p>

            <h2 id="cookies">Cookies</h2>
            <p>
              Aucun cookie ni traceur n&apos;est déposé pour les visiteurs, et aucun outil de mesure d&apos;audience n&apos;est utilisé.
              L&apos;espace d&apos;administration utilise des cookies de session strictement nécessaires à la connexion, et votre choix de
              thème (clair ou sombre) est conservé dans votre navigateur&nbsp;; ces traceurs sont exemptés de consentement (article 82 de la
              loi Informatique et Libertés).
            </p>

            <h2 id="droit-de-reponse">Droit de réponse et rectification</h2>
            <p>
              Toute personne nommée ou désignée sur ce site peut exercer un droit de réponse auprès du directeur ou de la directrice de la
              publication (loi n°&nbsp;2004-575 du 21 juin 2004 et décret n°&nbsp;2007-1527 du 24 octobre 2007). Une commune, un élu ou une entreprise qui
              constate une erreur peut aussi nous écrire à {contact}&nbsp;: nous corrigeons au plus vite et signalons la correction.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
