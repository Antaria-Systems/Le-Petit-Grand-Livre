# Analyse d'impact simplifiée (RGPD, article 35)

Traitement : publication des finances communales et des documents obtenus au titre du CRPA. Méthode inspirée du modèle PIA de la CNIL, en version allégée. Dernière mise à jour : 21/11/2026.

## Pourquoi une analyse

Le traitement croise plusieurs sources et publie des documents à grande échelle (à terme, toutes les communes) : deux critères des lignes directrices WP248. Une analyse est donc recommandée.

## Risques et mesures

| Risque | Gravité | Vraisemblance | Mesures |
|---|---|---|---|
| Publication d'une donnée personnelle mal occultée (IBAN, téléphone, adresse) | Importante | Limitée | Détection automatique + vérification humaine de chaque zone ; version publique re-rastérisée (aucun texte caché) ; contrôle automatique avant publication (courriels nominatifs, IBAN, RIB, NIR, mobiles) qui bloque la publication ; publication uniquement si le document n'a pas changé pendant la génération ; retrait immédiat (pas de cache prolongé) et purge Cloudflare si nécessaire ; procédure de retrait sur signalement. |
| Accès non autorisé aux originaux non occultés | Importante | Négligeable | Chiffrement AES-256-GCM, clé hors base ; administration réservée à un groupe Authentik ; base sans accès réseau extérieur ; aucun original servi par le site ; suppression des originaux après 5 ans. |
| Mauvaise interprétation d'un chiffre présentée comme une faute d'un élu (atteinte à la réputation) | Importante | Limitée | Barème légal à jour et présenté comme taux de référence (enveloppe, majorations) ; aucun signalement automatique d'écart ; couleurs neutres pour les écarts à la médiane ; méthodologie publiée ; droit de réponse et correction rapide. |
| Perte des données (panne, erreur) | Modérée | Limitée | Sauvegardes quotidiennes chiffrées, test de restauration ; journal des demandes conservé. |
| Indexation par les moteurs d'un document retiré | Modérée | Limitée | `noarchive` ; retrait immédiat ; demande de suppression via Search Console en cas d'erreur. |

## Actions restant à mener

- Accepter le contrat de sous-traitance de Hetzner (console Hetzner) et le Cloud Data Processing Addendum de Google Workspace.
- Supprimer de la messagerie les pièces jointes reçues une fois importées sur la plateforme (les originaux y sont en clair).
- Conserver hors du serveur la clé `ORIGINALS_KEY` et le mot de passe des sauvegardes.
- Réexaminer cette analyse avant chaque extension importante (nouveau type de document, nouvelle région).
