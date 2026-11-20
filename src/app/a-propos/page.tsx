import type { Metadata } from "next";
import { ACompleter } from "@/components/ACompleter";
import { site } from "@/lib/config";

export const metadata: Metadata = { title: "À propos" };

export default function APropos() {
  return (
    <section className="section">
      <div className="conteneur prose">
        <p className="surtitre">À propos</p>
        <h1>Rendre lisibles les finances locales</h1>
        <p className="chapo">
          Les comptes des communes sont publics, mais dispersés dans des fichiers de plusieurs centaines de milliers de
          lignes. Les documents les plus parlants (indemnités, frais, factures de travaux) ne sont souvent publiés nulle
          part.
        </p>
        <p>
          {site.nom} est né d&apos;une demande de documents adressée à la mairie d&apos;un village de l&apos;Aude. Le
          principe est simple : demander ces documents à toutes les mairies, dans le respect du droit d&apos;accès
          prévu par le CRPA, puis les publier sous une forme que chacun peut comprendre.
        </p>

        <h2>Pourquoi ce nom</h2>
        <p>
          En comptabilité, le <em>grand livre</em> est le registre où sont inscrites toutes les opérations
          d&apos;une organisation. Celui des communes existe, mais il est réservé aux spécialistes. {site.nom} en est la
          version lisible par tout le monde.
        </p>

        <h2>Qui sommes-nous</h2>
        <p>
          La plateforme est éditée par l&apos;association <ACompleter valeur={site.asso.nom} libelle="nom de l'association" />.
          Elle est indépendante : elle n&apos;est rattachée ni à l&apos;État, ni à une collectivité, ni à un parti politique.
        </p>

        <h2>Notre ligne</h2>
        <ul>
          <li>Des faits et des sources, pas de commentaire sur les choix des élus.</li>
          <li>Une demande par an et par commune, pour ne pas surcharger les secrétariats de mairie.</li>
          <li>Des données personnelles protégées : occultation systématique, publication par fonction.</li>
          <li>Tout est ouvert : code sous licence AGPL-3.0, données sous Licence Ouverte 2.0.</li>
        </ul>

        <h2 id="contact">Contact</h2>
        <p>
          <ACompleter valeur={site.asso.email} libelle="adresse de contact" />
        </p>
      </div>
    </section>
  );
}
