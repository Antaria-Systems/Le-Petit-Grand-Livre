-- CreateEnum
CREATE TYPE "TravailDocument" AS ENUM ('ANALYSER', 'GENERER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CategorieDocument" ADD VALUE 'DEVIS';
ALTER TYPE "CategorieDocument" ADD VALUE 'BON_DE_COMMANDE';
ALTER TYPE "CategorieDocument" ADD VALUE 'FACTURE';
ALTER TYPE "CategorieDocument" ADD VALUE 'SUBVENTION';

-- AlterEnum
ALTER TYPE "StatutDocument" ADD VALUE 'EN_ANALYSE';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "erreur" TEXT,
ADD COLUMN     "lot" TEXT,
ADD COLUMN     "travail" "TravailDocument";

-- CreateTable
CREATE TABLE "PageDocument" (
    "id" SERIAL NOT NULL,
    "documentId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "largeur" INTEGER NOT NULL,
    "hauteur" INTEGER NOT NULL,
    "cheminChiffre" TEXT NOT NULL,

    CONSTRAINT "PageDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageDocument_documentId_numero_key" ON "PageDocument"("documentId", "numero");

-- CreateIndex
CREATE INDEX "Document_travail_idx" ON "Document"("travail");

-- CreateIndex
CREATE UNIQUE INDEX "Document_communeCode_sha256Original_key" ON "Document"("communeCode", "sha256Original");

-- AddForeignKey
ALTER TABLE "PageDocument" ADD CONSTRAINT "PageDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

