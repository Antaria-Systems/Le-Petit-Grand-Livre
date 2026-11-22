# Installation

Installer la plateforme, en développement ou en production : prérequis, variables d'environnement, base de données, connexion Authentik, relais de messagerie, reverse proxy.

← [Retour au README](../README.md)

---

## Sommaire

1. [Prérequis](#1-prérequis)
2. [Variables d'environnement](#2-variables-denvironnement)
3. [Développement local](#3-développement-local)
4. [Production, pas à pas](#4-production-pas-à-pas)
5. [Connexion Authentik](#5-connexion-authentik)
6. [Relais de messagerie](#6-relais-de-messagerie)
7. [Reverse proxy et Cloudflare](#7-reverse-proxy-et-cloudflare)
8. [Vérifications après installation](#8-vérifications-après-installation)

---

## 1. Prérequis

| Élément | Minimum conseillé |
|---|---|
| Serveur | Linux, 2 vCPU, 4 Go de RAM, 20 Go de disque libre (les images du worker font environ 2 Go) |
| Logiciels | Docker Engine et Docker Compose v2 ; `rsync` et `7z` pour les sauvegardes |
| Réseau | Un reverse proxy HTTPS devant l'application (Nginx Proxy Manager, Caddy, Traefik…) |
| Nom de domaine | Pointant vers le reverse proxy (éventuellement via Cloudflare) |
| Connexion | Une instance **Authentik** (ou adapter `src/auth.ts` à un autre fournisseur OIDC) |
| Messagerie | Un relais SMTP autorisé à envoyer au nom du domaine (Google Workspace, ou autre) |
| Développement | Node.js 24 ; pour lancer le worker hors Docker : `poppler-utils`, `tesseract-ocr`, `tesseract-ocr-fra` |

---

## 2. Variables d'environnement

Toutes dans `.env` (jamais commité), modèle dans `.env.example`. Docker Compose transmet à chaque service **uniquement** les variables qui le concernent.

### Identité et périmètre

| Variable | Exemple | Usage |
|---|---|---|
| `SITE_NAME` | `Le Petit Grand Livre` | Nom affiché partout. |
| `SITE_URL` | `https://lpgl.exemple.fr` | Adresse publique (liens canoniques, plan du site, courriers). |
| `ASSO_NOM`, `ASSO_SIREN`, `ASSO_RNA`, `ASSO_ADRESSE` | | Éditeur (mentions légales, courriers). |
| `ASSO_EMAIL` | `contact@exemple.fr` | Contact public, copie cachée des demandes. |
| `ASSO_TELEPHONE` | `04 00 00 00 00` | **Obligatoire** pour une personne morale (LCEN). |
| `DIRECTEUR_PUBLICATION` | `Prénom Nom, président` | Mentions légales, signature des courriers. |
| `HEBERGEUR` | `Hetzner Online GmbH, adresse, téléphone` | Mentions légales. |
| `SOURCE_URL` | `https://github.com/…` | Lien « Code source » (AGPL). |
| `DEPARTEMENTS_ACTIFS` | `11` | Départements couverts au démarrage (les autres s'activent depuis l'administration). |
| `APP_ECOUTE` | `127.0.0.1:8087` | Adresse et port d'écoute du site, vus par le reverse proxy. |

### Base de données et stockage

| Variable | Usage |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Propriétaire de la base (migrations, service `tools`). |
| `POSTGRES_APP_PASSWORD` | Mot de passe du rôle `lpgl_app` (application et workers). `openssl rand -hex 24` |
| `DATABASE_URL` | Développement uniquement (en production, Compose construit l'adresse). |
| `STORAGE_DIR` | Développement uniquement (`./storage`) ; en production, volume monté sur `/data/storage`. |
| `ORIGINALS_KEY` | Clé AES-256 des originaux, 64 caractères hexadécimaux : `openssl rand -hex 32`. **À sauvegarder hors du serveur : sans elle, les originaux sont illisibles.** |

### Connexion

| Variable | Usage |
|---|---|
| `AUTH_URL` | Adresse publique du site (`https://…`). |
| `AUTH_SECRET` | Secret de session Auth.js : `openssl rand -base64 32`. |
| `AUTH_AUTHENTIK_ID`, `AUTH_AUTHENTIK_SECRET` | Identifiants du fournisseur OAuth2 dans Authentik. |
| `AUTH_AUTHENTIK_ISSUER` | `https://authentik.exemple.fr/application/o/<slug>/` |
| `AUTH_ADMIN_GROUP` | Groupe Authentik autorisé (**obligatoire** : vide, personne n'a accès). |
| `ADMIN_BASIC`, `ADMIN_USER`, `ADMIN_PASSWORD` | Développement uniquement : accès HTTP Basic si `ADMIN_BASIC=1` **et** Authentik non configuré. |

### Messagerie et supervision

| Variable | Usage |
|---|---|
| `SMTP_HOST`, `SMTP_PORT` | Relais (`smtp-relay.gmail.com`, `587`). |
| `SMTP_USER`, `SMTP_PASSWORD` | Vides si le relais autorise l'adresse IP du serveur. |
| `SMTP_FROM`, `SMTP_FROM_NAME` | Expéditeur des demandes. |
| `SMTP_EHLO` | Nom annoncé au relais (le domaine). |
| `KUMA_PUSH_URL` | Facultatif : moniteur « push » Uptime Kuma appelé chaque minute par le worker `envois`. |

---

## 3. Développement local

```sh
git clone https://github.com/Antaria-Systems/Le-Petit-Grand-Livre.git && cd Le-Petit-Grand-Livre
cp .env.example .env            # renseigner POSTGRES_*, DATABASE_URL (localhost:5433), ORIGINALS_KEY
npm ci                          # génère aussi le client Prisma
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npx prisma migrate deploy
npm run import:all              # référentiel, comptes et mairies de DEPARTEMENTS_ACTIFS
```

Lancer le site (administration en HTTP Basic, développement uniquement) :

```sh
ADMIN_BASIC=1 ADMIN_USER=admin ADMIN_PASSWORD="$(openssl rand -base64 24)" npm run dev
```

Lancer le worker (analyse des documents, envois programmés). Il faut `poppler-utils` et `tesseract-ocr-fra` sur la machine ; sinon, utiliser l'image `tools`.

```sh
SMTP_HOST=smtp.invalid npm run worker     # aucun courriel ne peut partir
```

> **Ne jamais pointer un environnement de développement vers un vrai relais SMTP avec des demandes programmées** : utilisez `SMTP_HOST=smtp.invalid`. Les tests d'envoi utilisent un transport factice.

Contrôles :

```sh
npm run typecheck
npm test                                                   # tests sans base
TEST_DATABASE_URL=postgresql://dev:dev@localhost:5433/dev npm test   # + tests d'envoi (base jetable)
```

---

## 4. Production, pas à pas

```sh
# 1. Code et configuration
git clone https://github.com/Antaria-Systems/Le-Petit-Grand-Livre.git /opt/lpgl && cd /opt/lpgl
cp .env.example .env && chmod 600 .env      # tout remplir (section 2)

# 2. Images
docker compose build app worker tools

# 3. Base de données et schéma
docker compose up -d db
docker compose run --rm tools npx prisma migrate deploy
```

**4. Rôle limité pour l'application et les workers** (une fois) :

```sh
set -a; . ./.env; set +a
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
CREATE ROLE lpgl_app LOGIN PASSWORD '$POSTGRES_APP_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO lpgl_app;
GRANT USAGE ON SCHEMA public TO lpgl_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lpgl_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lpgl_app;
ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lpgl_app;
ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lpgl_app;
REVOKE ALL ON "_prisma_migrations" FROM lpgl_app;
GRANT SELECT ON "_prisma_migrations" TO lpgl_app;
SQL
```

```sh
# 5. Données ouvertes
docker compose run --rm tools npm run import:all

# 6. Démarrage
docker compose up -d app worker envois
docker compose ps                         # les trois services doivent être « healthy »
```

7. Configurer le reverse proxy (section 7), Authentik (section 5), le relais (section 6).
8. Installer les sauvegardes et le déploiement réversible : [exploitation.md](exploitation.md).

Les mises à jour suivantes se font avec `scripts/exploitation/deployer.sh`.

---

## 5. Connexion Authentik

1. **Provider** : *Applications → Providers → Create → OAuth2/OpenID Provider*.
   - Client type : *Confidential* ; noter le *Client ID* et le *Client Secret* (`AUTH_AUTHENTIK_ID`, `AUTH_AUTHENTIK_SECRET`).
   - *Redirect URIs* : `https://<domaine>/api/auth/callback/authentik`.
   - Scopes : `openid`, `email`, `profile` (le mappage *profile* d'Authentik inclut le claim `groups`).
2. **Application** : *Applications → Create*, liée au provider ; son *slug* donne `AUTH_AUTHENTIK_ISSUER` = `https://<authentik>/application/o/<slug>/`.
3. **Groupe** : créer le groupe nommé dans `AUTH_ADMIN_GROUP` et y ajouter les administrateurs.
4. Redémarrer l'application : `docker compose up -d app`.

Si le claim `groups` n'est pas dans le jeton d'identité, l'application le lit sur l'endpoint *userinfo*. Une connexion refusée est journalisée côté serveur (identifiant et groupes reçus) ; la page de connexion affiche seulement « Ce compte n'est pas autorisé… ».

Sans les quatre variables Authentik, l'administration est **fermée** (réponse 503), sauf `ADMIN_BASIC=1` en développement.

---

## 6. Relais de messagerie

Exemple avec le relais **Google Workspace** (*Console d'administration → Applications → Gmail → Routage → Service de relais SMTP*) :

- Expéditeurs autorisés : *Seulement les adresses de mes domaines* ;
- Authentification : *Autoriser seulement les adresses IP suivantes* → l'adresse IP **sortante** du serveur ;
- *Exiger le chiffrement TLS* : oui.

Côté DNS du domaine : SPF incluant `_spf.google.com`, DKIM (`google._domainkey`), DMARC.

Vérifier la connexion **sans rien envoyer** :

```sh
docker compose exec envois node --import tsx scripts/verifier-smtp.ts
# → Relais SMTP smtp-relay.gmail.com:587 joignable, TLS OK, expéditeur …
```

Le relais ne vérifie l'autorisation de l'adresse IP qu'au moment d'un envoi : faire un **envoi de test vers une adresse de l'association** avant la première campagne.

---

## 7. Reverse proxy et Cloudflare

- Rediriger le domaine vers `APP_ECOUTE` (par exemple `http://<adresse privée du serveur>:8087`), en transmettant `Host` et `X-Forwarded-Proto`.
- Taille maximale des requêtes : au moins **100 Mo** (dépôt de documents).
- **HSTS** : à activer sur le reverse proxy (l'application ne l'envoie pas, pour éviter un en-tête en double). Avec `preload`, ajouter `includeSubDomains` seulement si tous les sous-domaines sont en HTTPS.
- **Cloudflare** : *SSL/TLS → Edge Certificates* → *Always Use HTTPS* activé, *Minimum TLS Version* 1.2. Une règle de limitation de débit sur `/api/*` est conseillée.

L'application envoie elle-même : `Content-Security-Policy` (sources limitées au site, sauf pour les PDF), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. L'administration répond en `private, no-store` avec `X-Robots-Tag: noindex`.

---

## 8. Vérifications après installation

| Vérification | Commande ou action | Attendu |
|---|---|---|
| Services | `docker compose ps` | `app`, `worker`, `envois` *healthy* |
| Site | ouvrir l'accueil, une fiche, `/sitemap.xml`, `/robots.txt` | 200 |
| Administration | `/admin` sans session | redirection vers `/connexion` |
| Connexion | se connecter avec un compte du groupe | tableau de bord, workers « Actif » |
| Isolation | `docker exec <worker> node -e "fetch('https://example.com').then(()=>console.log('KO'),()=>console.log('OK'))"` | `OK` (pas d'Internet) |
| Relais | `verifier-smtp.ts`, puis un envoi de test | « TLS OK », courriel reçu |
| Sauvegarde | `systemctl start sauvegarde-lpgl.service` puis test de restauration | voir [exploitation.md](exploitation.md) |
