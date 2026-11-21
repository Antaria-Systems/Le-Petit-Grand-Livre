-- Réservation atomique des envois de demandes
ALTER TABLE "Demande" ADD COLUMN "envoiEnCoursLe" TIMESTAMP(3);

-- Révision des documents (course génération / édition) et compteur d'échecs du worker
ALTER TABLE "Document" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tentatives" INTEGER NOT NULL DEFAULT 0;

-- Population totale (barème légal des indemnités)
ALTER TABLE "Commune" ADD COLUMN "populationTotale" INTEGER;

-- État partagé worker / administration
CREATE TABLE "Etat" (
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Etat_pkey" PRIMARY KEY ("cle")
);

CREATE INDEX "Document_demandeId_idx" ON "Document"("demandeId");
CREATE INDEX "Document_operationId_idx" ON "Document"("operationId");
