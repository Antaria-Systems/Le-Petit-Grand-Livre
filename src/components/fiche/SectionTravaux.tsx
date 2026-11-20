import { formatEuros } from "@/lib/format";
import type { Chantier } from "@/lib/travaux";
import { ClassementChantiers, ListeChantiers } from "./ChantiersTravaux";
import { EnTeteSection } from "./EnTeteSection";

type Props = {
  chantiers: Chantier[];
  totaux: { facture: number; nbFactures: number; entreprises: number; anneeMin: number | null; anneeMax: number | null };
};

export function SectionTravaux({ chantiers, totaux }: Props) {
  return (
    <section id="travaux" className="bloc" aria-labelledby="titre-travaux">
      <EnTeteSection
        id="titre-travaux"
        surtitre="Documents de la mairie"
        titre="Travaux et marchés"
        description="Chantiers reconstitués à partir des délibérations, devis, bons de commande et factures obtenus auprès de la mairie."
      />
      {chantiers.length === 0 ? (
        <div className="vide">
          <strong>Aucun chantier documenté pour l&apos;instant.</strong>
          <p style={{ margin: "8px 0 0" }}>Les devis et factures de travaux sont demandés à la mairie dans la demande groupée annuelle.</p>
        </div>
      ) : (
        <>
          <dl className="chiffres-cles">
            <div>
              <dt>Factures de travaux</dt>
              <dd>{formatEuros(totaux.facture)}</dd>
            </div>
            <div>
              <dt>Chantiers</dt>
              <dd>{chantiers.length}</dd>
            </div>
            <div>
              <dt>Entreprises</dt>
              <dd>{totaux.entreprises}</dd>
            </div>
            {totaux.anneeMin && totaux.anneeMax && (
              <div>
                <dt>Période couverte</dt>
                <dd>
                  {totaux.anneeMin}–{totaux.anneeMax}
                </dd>
              </div>
            )}
          </dl>

          <div className="travaux-grille">
            <div className="carte">
              <h3>Montants facturés par chantier</h3>
              <p className="sous-titre">En euros TTC, d&apos;après les factures reçues · cliquez pour ouvrir le chantier</p>
              <ClassementChantiers chantiers={chantiers} />
            </div>
            <div className="carte encadre-methode">
              <h3>Comment lire ces montants</h3>
              <ul>
                <li>
                  <strong>Facturé</strong> : somme des factures reçues (montant net payé TTC). Une facture absente de la réponse de la mairie
                  n&apos;est pas comptée.
                </li>
                <li>
                  <strong>Voté ou commandé</strong> : montant décidé par le conseil municipal ou porté sur les bons de commande.
                </li>
                <li>Montants relevés sur les documents ; chaque pièce est consultable pour vérification.</li>
              </ul>
            </div>
          </div>

          <ListeChantiers chantiers={chantiers} />
        </>
      )}
    </section>
  );
}
