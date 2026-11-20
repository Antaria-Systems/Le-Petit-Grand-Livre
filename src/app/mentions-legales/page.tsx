import type { Metadata } from "next";
import { ACompleter } from "@/components/ACompleter";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <section className="section">
      <div className="conteneur prose">
        <h1>Mentions légales</h1>

        <h2>Éditeur</h2>
        <p>
          Association <ACompleter valeur={site.asso.nom} libelle="nom" />, association loi 1901
          <br />
          RNA : <ACompleter valeur={site.asso.rna} libelle="numéro RNA" />
          <br />
          Siège : <ACompleter valeur={site.asso.adresse} libelle="adresse du siège" />
          <br />
          Contact : <ACompleter valeur={site.asso.email} libelle="adresse électronique" />
        </p>
        <p>
          Directeur ou directrice de la publication : <ACompleter valeur={site.directeurPublication} libelle="nom" />
        </p>

        <h2>Hébergement</h2>
        <p>
          <ACompleter valeur={site.hebergeur} libelle="hébergeur (nom, adresse, téléphone)" />
        </p>

        <h2>Nature du site</h2>
        <p>
          Ce site est édité par une association indépendante. Il n&apos;est pas un site de l&apos;État, d&apos;une
          administration ni d&apos;une collectivité territoriale.
        </p>

        <h2>Licences</h2>
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
    </section>
  );
}
