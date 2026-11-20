-- CreateEnum
CREATE TYPE "StatutOperation" AS ENUM ('PREVUE', 'EN_COURS', 'REALISEE');

-- CreateEnum
CREATE TYPE "CategorieDocument" AS ENUM ('BUDGET', 'COMPTE_ADMINISTRATIF', 'DELIBERATION', 'INDEMNITES', 'FRAIS', 'TRAVAUX', 'MARCHE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutDocument" AS ENUM ('RECU', 'A_VERIFIER', 'OCCULTE', 'PUBLIE', 'NON_PUBLIABLE');

-- CreateEnum
CREATE TYPE "MotifOccultation" AS ENUM ('DONNEES_BANCAIRES', 'COORDONNEES_PERSO', 'SIGNATURE', 'VIE_PRIVEE', 'APPRECIATION_PERSONNE', 'SECRET_AFFAIRES', 'AUTRE');

-- CreateEnum
CREATE TYPE "SourceZone" AS ENUM ('AUTO', 'MANUEL');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('BROUILLON', 'ENVOYEE', 'RELANCEE', 'REFUS_IMPLICITE', 'REFUS_EXPRES', 'CADA_SAISIE', 'REPONSE_PARTIELLE', 'SATISFAITE', 'ABANDONNEE');

-- CreateEnum
CREATE TYPE "SensMessage" AS ENUM ('SORTANT', 'ENTRANT');

-- CreateTable
CREATE TABLE "Region" (
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Departement" (
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "regionCode" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Departement_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Commune" (
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "nomRecherche" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "departementCode" TEXT NOT NULL,
    "population" INTEGER,
    "codesPostaux" TEXT[],
    "siren" TEXT,
    "epciNom" TEXT,
    "strate" INTEGER,
    "mairieEmail" TEXT,
    "mairieTelephone" TEXT,
    "mairieAdresse" TEXT,
    "mairieSite" TEXT,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commune_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "AgregatFinancier" (
    "id" SERIAL NOT NULL,
    "communeCode" TEXT NOT NULL,
    "exercice" INTEGER NOT NULL,
    "agregat" TEXT NOT NULL,
    "typeBudget" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "parHabitant" DOUBLE PRECISION,

    CONSTRAINT "AgregatFinancier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceStrate" (
    "id" SERIAL NOT NULL,
    "exercice" INTEGER NOT NULL,
    "strate" INTEGER NOT NULL,
    "agregat" TEXT NOT NULL,
    "medianeParHabitant" DOUBLE PRECISION NOT NULL,
    "moyenneParHabitant" DOUBLE PRECISION NOT NULL,
    "nbCommunes" INTEGER NOT NULL,

    CONSTRAINT "ReferenceStrate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndemniteFonction" (
    "id" SERIAL NOT NULL,
    "communeCode" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "fonction" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "montantBrutAnnuel" DECIMAL(12,2) NOT NULL,
    "documentId" TEXT,

    CONSTRAINT "IndemniteFonction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraisFonction" (
    "id" SERIAL NOT NULL,
    "communeCode" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "fonction" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "libelle" TEXT,
    "date" DATE,
    "montant" DECIMAL(12,2) NOT NULL,
    "documentId" TEXT,

    CONSTRAINT "FraisFonction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" SERIAL NOT NULL,
    "communeCode" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "categorie" TEXT,
    "annee" INTEGER,
    "date" DATE,
    "montantHT" DECIMAL(14,2),
    "montantTTC" DECIMAL(14,2),
    "prestataire" TEXT,
    "statut" "StatutOperation" NOT NULL DEFAULT 'REALISEE',
    "documentId" TEXT,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "communeCode" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "categorie" "CategorieDocument" NOT NULL,
    "annee" INTEGER,
    "dateDocument" DATE,
    "statut" "StatutDocument" NOT NULL DEFAULT 'RECU',
    "nomOriginal" TEXT NOT NULL,
    "cheminChiffre" TEXT NOT NULL,
    "sha256Original" TEXT NOT NULL,
    "typeMime" TEXT NOT NULL,
    "nbPages" INTEGER,
    "cheminPublic" TEXT,
    "sha256Public" TEXT,
    "demandeId" TEXT,
    "messageId" TEXT,
    "notes" TEXT,
    "recuLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publieLe" TIMESTAMP(3),
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneOccultation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "largeur" DOUBLE PRECISION NOT NULL,
    "hauteur" DOUBLE PRECISION NOT NULL,
    "motif" "MotifOccultation" NOT NULL,
    "source" "SourceZone" NOT NULL,
    "validee" BOOLEAN NOT NULL DEFAULT false,
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZoneOccultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demande" (
    "id" TEXT NOT NULL,
    "communeCode" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "objet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "statut" "StatutDemande" NOT NULL DEFAULT 'BROUILLON',
    "envoyeeLe" TIMESTAMP(3),
    "echeanceReponse" TIMESTAMP(3),
    "relanceeLe" TIMESTAMP(3),
    "limiteSaisineCada" TIMESTAMP(3),
    "cadaSaisieLe" TIMESTAMP(3),
    "numeroCada" TEXT,
    "clotureLe" TIMESTAMP(3),
    "creeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "sens" "SensMessage" NOT NULL,
    "de" TEXT NOT NULL,
    "a" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "messageIdEmail" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Departement_regionCode_idx" ON "Departement"("regionCode");

-- CreateIndex
CREATE UNIQUE INDEX "Commune_slug_key" ON "Commune"("slug");

-- CreateIndex
CREATE INDEX "Commune_departementCode_idx" ON "Commune"("departementCode");

-- CreateIndex
CREATE INDEX "Commune_nomRecherche_idx" ON "Commune"("nomRecherche");

-- CreateIndex
CREATE INDEX "AgregatFinancier_communeCode_exercice_idx" ON "AgregatFinancier"("communeCode", "exercice");

-- CreateIndex
CREATE UNIQUE INDEX "AgregatFinancier_communeCode_exercice_agregat_typeBudget_key" ON "AgregatFinancier"("communeCode", "exercice", "agregat", "typeBudget");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceStrate_exercice_strate_agregat_key" ON "ReferenceStrate"("exercice", "strate", "agregat");

-- CreateIndex
CREATE INDEX "IndemniteFonction_communeCode_annee_idx" ON "IndemniteFonction"("communeCode", "annee");

-- CreateIndex
CREATE INDEX "FraisFonction_communeCode_annee_idx" ON "FraisFonction"("communeCode", "annee");

-- CreateIndex
CREATE INDEX "Operation_communeCode_annee_idx" ON "Operation"("communeCode", "annee");

-- CreateIndex
CREATE INDEX "Document_communeCode_statut_idx" ON "Document"("communeCode", "statut");

-- CreateIndex
CREATE INDEX "ZoneOccultation_documentId_page_idx" ON "ZoneOccultation"("documentId", "page");

-- CreateIndex
CREATE INDEX "Demande_statut_idx" ON "Demande"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "Demande_communeCode_annee_key" ON "Demande"("communeCode", "annee");

-- CreateIndex
CREATE UNIQUE INDEX "Message_messageIdEmail_key" ON "Message"("messageIdEmail");

-- CreateIndex
CREATE INDEX "Message_demandeId_date_idx" ON "Message"("demandeId", "date");

-- AddForeignKey
ALTER TABLE "Departement" ADD CONSTRAINT "Departement_regionCode_fkey" FOREIGN KEY ("regionCode") REFERENCES "Region"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commune" ADD CONSTRAINT "Commune_departementCode_fkey" FOREIGN KEY ("departementCode") REFERENCES "Departement"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgregatFinancier" ADD CONSTRAINT "AgregatFinancier_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndemniteFonction" ADD CONSTRAINT "IndemniteFonction_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndemniteFonction" ADD CONSTRAINT "IndemniteFonction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraisFonction" ADD CONSTRAINT "FraisFonction_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraisFonction" ADD CONSTRAINT "FraisFonction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Operation" ADD CONSTRAINT "Operation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "Demande"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneOccultation" ADD CONSTRAINT "ZoneOccultation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demande" ADD CONSTRAINT "Demande_communeCode_fkey" FOREIGN KEY ("communeCode") REFERENCES "Commune"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "Demande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
