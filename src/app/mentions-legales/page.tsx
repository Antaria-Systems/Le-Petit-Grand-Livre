import type { Metadata } from "next";
import { EnTetePage } from "@/components/EnTetePage";
import { ACompleter } from "@/components/ACompleter";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <>
      <EnTetePage
        ariane={[{ libelle: "Mentions légales" }]}
        titre={<>Mentions légales</>}
      />
      <section className="section">
        <div className="conteneur page-avec-sommaire">
          <nav className="sommaire" aria-labelledby="titre-sommaire">
            <h2 id="titre-sommaire">Sommaire</h2>
            <ol>
              <li>
                <a href="#editeur">Éditeur</a>
              </li>
              <li>
                <a href="#hebergement">Hébergement</a>
              </li>
              <li>
                <a href="#nature-du-site">Nature du site</a>
              </li>
              <li>
                <a href="#licences">Licences</a>
              </li>
              <li>
                <a href="#donnees-personnelles">Données personnelles</a>
              </li>
            </ol>
          </nav>
          <div className="prose">

            <h2 id="editeur">Éditeur</h2>
            <p>
              Association <ACompleter valeur={site.asso.nom} libelle="nom" />, association loi 1901
              <br />
              RNA : <ACompleter valeur={site.asso.rna} libelle="numéro RNA" />
              {site.asso.siren && (
                <>
                  {" "}· SIREN : {site.asso.siren}
                </>
              )}
              <br />
              Siège : <ACompleter valeur={site.asso.adresse} libelle="adresse du siège" />
              <br />
              Contact : <ACompleter valeur={site.asso.email} libelle="adresse électronique" />
            </p>
            <p>
              Directeur ou directrice de la publication : <ACompleter valeur={site.directeurPublication} libelle="nom" />
            </p>

            <h2 id="hebergement">Hébergement</h2>
            <p>
              <ACompleter valeur={site.hebergeur} libelle="hébergeur (nom, adresse, téléphone)" />
            </p>

            <h2 id="nature-du-site">Nature du site</h2>
            <p>
              Ce site est édité par une association indépendante. Il n&apos;est pas un site de l&apos;État, d&apos;une
              administration ni d&apos;une collectivité territoriale.
            </p>

            <h2 id="licences">Licences</h2>
            <p>
              Le code source est distribué sous licence GNU AGPL-3.0. Les données publiées sont réutilisables selon les termes
              de la Licence Ouverte 2.0 (Etalab), sous réserve de mentionner la source et la date de mise à jour.
            </p>

            <h2 id="donnees-personnelles">Données personnelles</h2>
            <p>
              Les documents publiés proviennent d&apos;administrations et ont été occultés des mentions protégées par
              l&apos;article L.311-6 du CRPA. Les indemnités et frais des élus sont publiés par fonction, sans nom.
            </p>
            <p>
              Si vous estimez qu&apos;un document publié contient des données personnelles vous concernant, vous pouvez
              demander leur occultation ou leur retrait à <ACompleter valeur={site.asso.email} libelle="adresse électronique" />.
              Vous disposez également du droit d&apos;introduire une réclamation auprès de la CNIL.
            </p>
            <p>
              Le site ne dépose aucun cookie et n&apos;utilise aucun outil de mesure d&apos;audience tiers. Votre choix de
              thème (clair ou sombre) est conservé uniquement dans votre navigateur.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
