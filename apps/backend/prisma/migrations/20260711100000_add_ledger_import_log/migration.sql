-- CreateTable
CREATE TABLE "ledger_import_logs" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billCount" INTEGER NOT NULL,
    "invoiceCount" INTEGER NOT NULL,
    "duplicateBillCount" INTEGER NOT NULL,
    "duplicateInvoiceCount" INTEGER NOT NULL,
    "forcedDuplicates" BOOLEAN NOT NULL DEFAULT false,
    "rawDataJson" JSONB NOT NULL,

    CONSTRAINT "ledger_import_logs_pkey" PRIMARY KEY ("id")
);

