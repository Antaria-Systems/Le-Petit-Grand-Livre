# Sécurité

Ce que la plateforme protège, contre quoi, et comment. Pour signaler une vulnérabilité : [SECURITY.md](../SECURITY.md).

← [Retour au README](../README.md)

---

## Sommaire

1. [Ce qu'il faut protéger](#1-ce-quil-faut-protéger)
2. [Accès à l'administration](#2-accès-à-ladministration)
3. [Protection des données personnelles](#3-protection-des-données-personnelles)
4. [Fichiers reçus de tiers](#4-fichiers-reçus-de-tiers)
5. [Application web](#5-application-web)
6. [Infrastructure](#6-infrastructure)
7. [Envois aux mairies](#7-envois-aux-mairies)
8. [Audit et tests](#8-audit-et-tests)
9. [Limites connues et pistes](#9-limites-connues-et-pistes)

---

## 1. Ce qu'il faut protéger

| Bien | Risque principal | Gravité |
|---|---|---|
| Originaux non occultés (coordonnées, IBAN, signatures de tiers) | Fuite | Très élevée |
| Versions publiques | Publication d'une mention qui aurait dû être masquée | Très élevée |
| Administration | Prise de contrôle : publication, envoi de courriers au nom de l'association | Élevée |
| Relais de messagerie | Envoi de courriels au nom de l'association | Élevée |
| Base de données (demandes, journal, notes) | Altération, perte | Moyenne |
| Disponibilité du site | Panne, saturation d'un serveur partagé | Moyenne |

---

## 2. Accès à l'administration

- **Connexion** : Authentik (OIDC, avec PKCE), réservée à un **groupe** (`AUTH_ADMIN_GROUP`). Échec fermé : sans groupe configuré, personne n'est administrateur ; sans Authentik, l'administration est fermée (réponse 503).
- **HTTP Basic** : seulement sur activation explicite (`ADMIN_BASIC=1`) et sans Authentik, pour le développement ; comparaison en temps constant, mot de passe de 16 caractères au moins.
- **Session** : jeton JWT signé, cookies `__Host-` / `__Secure-`, `HttpOnly`, `Secure`, `SameSite=Lax`, 8 h glissantes et **24 h au plus** (reconnexion obligatoire).
- **Vérification à chaque niveau** : `src/proxy.ts` (en amont de `/admin` et `/api/admin`), le layout de l'administration, **chaque page** (`verifierAdminPage`), **chaque action serveur** (`exigerAdmin`) et **chaque route API** (`refusAdmin`).
- **CSRF** : protection intégrée des actions serveur de Next.js ; pour les routes API en écriture, `Sec-Fetch-Site: same-origin` exigé, ou à défaut un en-tête `Origin` comparé aux origines **configurées** (jamais déduites des en-têtes de la requête).
- **Redirection après connexion** : limitée aux chemins `/admin…`, analysée comme le ferait le navigateur (pas de redirection ouverte).
- La page de connexion n'affiche pas le nom du groupe requis ; les refus sont journalisés côté serveur.

---

## 3. Protection des données personnelles

- **Originaux et aperçus chiffrés au repos** (AES-256-GCM, IV aléatoire, tag vérifié) ; clé hors de la base et des journaux ; déchiffrement uniquement en mémoire (tmpfs), pour la durée d'un traitement.
- **Jamais servis au public** : la seule route publique de documents ne sert que la version occultée d'un document `PUBLIE` (sinon 404) ; les aperçus sont réservés à l'administration, en `private, no-store`.
- **Versions publiques reconstruites en images** : pas de texte caché, de calque, d'annotation, de pièce jointe, de JavaScript ni de métadonnée d'auteur.
- **Contrôle avant publication** (courriels nominatifs, IBAN, RIB, n° de sécurité sociale, mobiles) qui bloque la mise en ligne ; valeurs détectées **masquées** dans les messages enregistrés.
- **Révision des documents** : une version générée avant une modification n'est jamais publiée.
- **Dépublication immédiate** à toute modification d'une zone ; PDF publics revalidés à chaque ouverture (`no-cache` + `ETag`).
- **Minimisation** : réponses publiques construites avec des sélections explicites (aucune note interne, aucun courriel saisi, aucun chemin de stockage) ; indemnités par fonction ; durée de conservation des originaux de 5 ans.

Voir aussi [documents-occultation.md](documents-occultation.md) et [cadre-juridique.md](cadre-juridique.md).

---

## 4. Fichiers reçus de tiers

Les PDF et images viennent des mairies et de leurs fournisseurs : ils sont traités comme **non fiables**.

- **Dépôt** : accès vérifié **avant** la lecture du corps ; taille annoncée et lue plafonnées (100 Mo) ; type reconnu par le contenu ; HTML et SVG ignorés ; ZIP décompressés en mémoire avec limites (taille, nombre d'entrées, profondeur, chemins `../` refusés) ; images limitées à 60 mégapixels.
- **Traitement isolé** : rendu et OCR dans le worker `documents`, **sans accès à Internet**, sans relais de messagerie ni secret de connexion, système de fichiers en **lecture seule** (le code ne peut pas être modifié par le processus), utilisateur non root, capacités retirées, limites de processus et de mémoire.
- **Garde-fous** : 500 pages au plus, pages plus grandes que l'A0 refusées, 3 minutes au plus par outil et par page (processus tué au-delà), rendu vérifié (une page rendue à moitié est une erreur), abandon après 3 échecs.
- **Version publique** : seul ce qui a été rendu en image ressort ; le contenu actif du PDF d'origine ne peut pas passer.

---

## 5. Application web

- **Injections** : accès à la base par Prisma (requêtes paramétrées) ; aucune requête SQL construite par concaténation.
- **XSS** : rendu React échappé ; un seul script en ligne, statique (thème) ; liens externes de l'Annuaire filtrés (`http(s)://` seulement).
- **En-têtes** : `Content-Security-Policy` (sources limitées au site, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `upgrade-insecure-requests`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. HSTS par le reverse proxy.
- **Validation** : toutes les entrées des actions et des API passent par zod (clés inconnues ignorées, bornes sur les dates, montants et tailles) ; identifiants inconnus ou JSON invalides : 400 ou 404, jamais d'erreur interne.
- **Limitation de débit** : la recherche publique (`/api/communes`) est limitée par adresse IP.
- **Pas de cookie ni de traceur** pour les visiteurs ; polices auto-hébergées, aucune ressource tierce.

---

## 6. Infrastructure

- **Réseaux** : base de données et worker `documents` sur un réseau Docker **interne** ; le site n'écoute que sur une adresse privée, derrière le reverse proxy et Cloudflare.
- **Secrets par service** (voir [architecture.md](architecture.md#2-les-services)) ; `.env` en `600`, jamais commité.
- **Base** : l'application et les workers utilisent `lpgl_app` (lecture et écriture des données, aucun droit sur le schéma, pas superutilisateur).
- **Conteneurs** : non root, `cap_drop: ALL`, `no-new-privileges`, lecture seule, `pids_limit`, `init`, limites de mémoire et de CPU, journaux plafonnés, contrôles de santé.
- **Images** : l'image du site ne contient ni poppler ni tesseract ; reconstruction mensuelle conseillée pour les correctifs système.
- **Sauvegardes** : quotidiennes, chiffrées (AES-256) pour la copie hors serveur ; compte SSH de récupération limité par une commande forcée à la seule lecture de l'archive.
- **Dépendances** : versions figées (`package-lock.json`), scripts d'installation soumis à approbation (`allowScripts`), `npm audit` à surveiller.

---

## 7. Envois aux mairies

Un courrier envoyé deux fois, ou envoyé sans relecture, nuirait à l'association :

- confirmation explicite (case + boîte de dialogue propre au bouton) ;
- **réservation atomique** avant tout appel SMTP, commune aux envois immédiats, programmés et en lot ;
- état incertain conservé et signalé (« ne pas renvoyer ») ;
- aucun nouvel essai automatique ; envoi en retard de plus de 6 h annulé ;
- transport SMTP avec STARTTLS obligatoire, TLS 1.2 minimum, sans accès aux fichiers ni aux URL ; en-têtes protégés contre les injections (CRLF) ; destinataire validé.

Détails : [demandes-crpa.md](demandes-crpa.md#6-garanties--jamais-deux-envois).

---

## 8. Audit et tests

- La plateforme a fait l'objet d'un **audit complet** (accès, entrées et fichiers, confidentialité, infrastructure, ergonomie, données, juridique, performance) dont les constats ont été corrigés.
- **Tests automatisés** (`npm test`) : délais légaux, lecture des montants, clés IBAN / RIB / NIR, masquage des valeurs, et scénarios de double envoi (deux envois simultanés, envoi programmé + immédiat + trois workers, refus du relais, coupure en cours de transmission, retard de plus de 6 h).

---

## 9. Limites connues et pistes

- La politique de contenu autorise les scripts en ligne (données de Next.js) : un nonce par requête la rendrait plus stricte.
- La détection automatique ne trouve pas tout (noms, mentions manuscrites, adresses d'entrepreneurs individuels) : la vérification humaine reste indispensable.
- Les fichiers temporaires en mémoire peuvent être écrits dans l'espace d'échange (swap) du serveur en cas de forte pression mémoire ; chiffrer le swap supprimerait ce risque.
- La clé des originaux est transmise par variable d'environnement ; un secret Docker monté en fichier serait préférable.
