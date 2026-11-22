# Registre des activités de traitement (RGPD, article 30)

Responsable du traitement : association Antaria Systems (RNA W111010088, SIREN 130 674 724), 3 chemin de la Malepère, 11290 Lavalette. Contact : contact.lpgl@antaria-systems.fr. Représentant : le président, directeur de la publication.

Dernière mise à jour : 21/11/2026.

## Traitement n° 1 : publication des finances communales et des documents obtenus (Le Petit Grand Livre)

| Rubrique | Contenu |
|---|---|
| Finalité | Informer le public sur les finances des communes : données financières ouvertes (OFGL) et documents administratifs obtenus au titre du CRPA, occultés puis publiés. |
| Base légale | Intérêt légitime de l'association et du public à la transparence de l'action publique locale (art. 6.1.f RGPD), dans le cadre de la réutilisation des informations publiques (art. L.321-1 et L.322-2 CRPA). Mise en balance : voir `mise-en-balance.md`. |
| Personnes concernées | Élus municipaux ; agents communaux cités dans les documents ou les échanges ; dirigeants et entrepreneurs individuels des entreprises titulaires ; toute personne mentionnée dans un document communiqué. |
| Catégories de données publiées | Fonctions des élus, montants d'indemnités et de frais (par fonction) ; noms des élus dans les délibérations (documents publics, art. L.2121-26 CGCT) ; dénomination des entreprises et montants facturés ; nom et fonction des agents signataires d'actes. |
| Données non publiées (occultées) | Coordonnées personnelles (adresse, téléphone, courriel personnels), données bancaires (IBAN, RIB, BIC), signatures et mentions manuscrites d'identité qui les accompagnent, numéros de sécurité sociale, mentions relevant de la vie privée ou portant une appréciation sur une personne (art. L.311-6 CRPA), numéro et voie de l'adresse des entrepreneurs individuels. Secret des affaires : seules les pièces des entreprises retenues (devis acceptés, bons de commande, factures) sont publiées, avec leur détail ; occultation au cas par cas sur demande fondée d'une entreprise. |
| Données conservées sans publication | Originaux non occultés, chiffrés (AES-256-GCM) ; aperçus des pages, chiffrés ; correspondances avec les mairies (journal des demandes). |
| Sources | Documents communiqués par les mairies ; OFGL ; geo.api.gouv.fr ; Annuaire de l'administration (service-public.fr). |
| Destinataires | Le public (versions occultées uniquement). Accès aux originaux : administrateurs de l'association (groupe Authentik dédié). |
| Sous-traitants | Hetzner Online GmbH (hébergement, Allemagne, UE) ; Google Ireland / Google LLC (messagerie de l'association, Google Workspace ; transferts éventuels vers les États-Unis couverts par le cadre UE–États-Unis et les clauses contractuelles du Cloud Data Processing Addendum). |
| Transferts hors UE | Messagerie uniquement (voir ci-dessus). |
| Durées de conservation | Documents publiés : tant qu'ils sont utiles à l'information du public, 10 ans au plus après l'exercice concerné. Originaux non occultés et aperçus : 5 ans après publication, suppression automatique (worker, purge quotidienne). Correspondances avec les mairies : 5 ans. Journaux techniques (Docker) : rotation (10 Mo × 3 par service). |
| Mesures de sécurité | Originaux et aperçus chiffrés au repos (AES-256-GCM, clé hors base) ; versions publiques re-rastérisées (aucun texte sous les masques) et contrôle automatique avant publication (courriels, IBAN, RIB, NIR, mobiles) ; double vérification humaine ; administration réservée à un groupe Authentik (OIDC) ; base de données sans accès réseau extérieur ; HTTPS, en-têtes de sécurité ; sauvegardes quotidiennes chiffrées ; journal des envois. |
| Droits | Accès, rectification, effacement, limitation, opposition (art. 15 à 21) : contact.lpgl@antaria-systems.fr, réponse sous un mois. Information collective par la notice publique (art. 14.5.b) : page « Mentions légales ». |
| AIPD | Analyse simplifiée : voir `aipd.md`. |

## Traitement n° 2 : demandes de communication aux mairies (CRPA)

| Rubrique | Contenu |
|---|---|
| Finalité | Préparer, envoyer et suivre les demandes de communication, relances et saisines de la CADA. |
| Base légale | Intérêt légitime (exercice du droit d'accès, art. L.311-1 CRPA). |
| Données | Adresse électronique et coordonnées des mairies (publiques) ; noms et fonctions des agents qui répondent ; contenu des échanges. |
| Destinataires | Mairies concernées ; CADA en cas de saisine. |
| Conservation | 5 ans après la clôture de la demande. |

## Traitement n° 3 : comptes d'administration

| Rubrique | Contenu |
|---|---|
| Finalité | Authentifier les administrateurs. |
| Données | Identifiant, nom, groupes Authentik ; cookie de session (24 h au plus). |
| Conservation | Durée de la session ; journal des refus de connexion (identifiant refusé) dans les journaux techniques, rotation courte. |
