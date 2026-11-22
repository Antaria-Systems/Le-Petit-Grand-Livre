# Plateforme d'open data des finances communales

Budgets, indemnités des élus (par fonction), travaux et documents administratifs des communes,
obtenus au titre du droit d'accès aux documents administratifs (CRPA, art. L.311-1) et rendus lisibles.

- **Code** : GNU AGPL-3.0 · **Données publiées** : Licence Ouverte 2.0
- **Stack** : Next.js 16 · React 19 · Prisma 7 · PostgreSQL 17 · Docker

## Sources open data

| Donnée | Source |
|---|---|
| Comptes des communes (agrégats, 2018 →) | OFGL, jeu `ofgl-base-communes` |
| Médianes nationales par strate de population | OFGL (calculées via l'API) |
| Régions, départements, communes | geo.api.gouv.fr |
| Coordonnées des mairies | Annuaire de l'administration (service-public.fr) |

## Démarrage (développement)

```sh
cp .env.example .env            # puis remplir les valeurs (ORIGINALS_KEY : openssl rand -hex 32)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm install
npx prisma migrate deploy
npm run import:all              # ~2 min pour l'Aude
npm run dev
```

## Production

```sh
# Première installation : rôle limité aux données pour l'app et les workers (POSTGRES_APP_PASSWORD)
docker compose up -d db
docker compose run --rm tools npx prisma migrate deploy   # puis créer le rôle lpgl_app (voir scripts/exploitation)
docker compose run --rm tools npm run import:all

# Déploiements suivants : construit, étiquette (retour arrière possible), migre, redémarre
scripts/exploitation/deployer.sh   # site sur 10.1.0.2:8087
```

La base de données est sur un réseau Docker interne, sans accès à Internet. Le traitement des documents (`worker`)
n'a pas accès à Internet ; les envois et les imports passent par le service `envois`. Sauvegardes, supervision,
retour arrière et réglages Cloudflare : [`scripts/exploitation/README.md`](scripts/exploitation/README.md).

Tests : `npm test` (les tests d'envoi utilisent un transport factice et une base de test : `TEST_DATABASE_URL`).

## Documents et occultation

```sh
# 1. Importer un lot reçu d'une mairie (chiffré à l'entrée, dédoublonné, mis en file d'analyse)
docker compose run --rm --user 0 -v "/chemin/du/lot:/import:ro" tools \
  sh -c 'npx tsx scripts/import-documents.ts --commune 11199 --dossier /import --lot "Nom du lot" && chown -R node:node /data/storage'

# 2. Le worker analyse (rendu, OCR 300 dpi, détection IBAN / BIC / RIB / téléphones / e-mails,
#    signatures et tampons par analyse d'image)
docker compose logs -f worker   # documents ; « envois » pour les demandes programmées

# 3. Valider dans l'admin : /admin  (connexion Authentik, groupe AUTH_ADMIN_GROUP)
#    tracer les signatures et noms à masquer → « Générer la version occultée » → « Publier »
```

Outils :

- `scripts/detecter-signatures.ts` — propose des zones « Signature » sur les documents encore à vérifier
- `scripts/evaluer-signatures.ts` — mesure le détecteur de signatures contre les zones tracées à la main
- `scripts/supprimer-lot.ts` — supprime un lot (simulation par défaut, refuse les lots publiés)

Règles appliquées :

- Rien n'est publié automatiquement : chaque zone proposée doit être validée ou supprimée.
- Modifier les zones d'un document publié le **dépublie** jusqu'à la nouvelle génération.
- L'original reçu de la mairie est **chiffré** (AES-256-GCM, clé `ORIGINALS_KEY`) dans `storage/originaux/`
  et n'est jamais servi publiquement. **Sauvegardez la clé hors du serveur** : sans elle, les originaux sont perdus.
- Les aperçus de pages (non occultés) de l'admin sont aussi chiffrés ; le worker travaille dans un `/tmp` en mémoire.
- La version publique est rastérisée, les zones occultées sont noircies, puis le PDF est reconstruit :
  aucun texte ne subsiste sous les masques.
- Les élus sont publiés **par fonction**, jamais par nom.

## Administration

| Page | Rôle |
|---|---|
| `/admin` | Tableau de bord : documents à vérifier, échéances des demandes, territoires, imports |
| `/admin/regions` → région → département | Couverture des territoires ; « Couvrir et importer » lance l'import d'un département (worker) |
| `/admin/communes/<INSEE>` | Fiche d'administration : informations et présentation publique, chantiers, documents, indemnités et frais des élus, demandes CRPA / CADA |
| `/admin/demandes` | Suivi de toutes les demandes : refus implicite à un mois, saisine de la CADA dans les deux mois |
| `/admin/documents`, `/admin/depot` | File de vérification et dépôt de documents |

Demandes : une seule demande groupée par commune et par an ; le courrier type est généré en brouillon,
relu, puis envoyé par le relais SMTP **uniquement sur confirmation explicite**. Les échanges (réponse de la
mairie, relances, CADA) sont consignés dans le journal de la demande.

## Connexion et courriels

- **Connexion** : Authentik (OIDC, PKCE), réservée au groupe `AUTH_ADMIN_GROUP` (claim `groups`).
  Adresse de retour à déclarer : `https://<domaine>/api/auth/callback/authentik`.
  Sans Authentik configuré, l'administration est fermée ; un accès HTTP Basic (`ADMIN_USER` / `ADMIN_PASSWORD`) n'existe
  que sur activation explicite (`ADMIN_BASIC=1`, développement). Session de 24 h au plus.
- **Contrôle d'accès** vérifié à chaque niveau (`src/proxy.ts`, layout, chaque page, chaque route et action), requêtes
  d'écriture limitées aux origines configurées.
- **Envois** : réservation atomique avant tout appel au relais (jamais deux envois d'une même demande), état incertain
  signalé « ne pas renvoyer », retard de plus de 6 h annulé et signalé.
- **SMTP** : relais Google Workspace (`smtp-relay.gmail.com:587`, STARTTLS), autorisé par l'IP du serveur.
  Vérification sans envoi : `docker compose exec envois node --import tsx scripts/verifier-smtp.ts`

## Structure

```
prisma/schema.prisma        modèle de données (référentiel, finances, documents, demandes)
scripts/import-*.ts         imports open data
src/app/                    pages (accueil, région, département, commune, méthodologie…)
src/components/graphiques/  graphiques SVG accessibles (survol, clavier, tableau de données)
src/lib/                    accès aux données, formatage, stockage chiffré
```
