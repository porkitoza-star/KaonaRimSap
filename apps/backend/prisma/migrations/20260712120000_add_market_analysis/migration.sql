-- CreateEnum
CREATE TYPE "MarketPositioning" AS ENUM ('RED_OCEAN', 'BLUE_OCEAN');

-- CreateTable
CREATE TABLE "market_comparables" (
    "id" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "developerName" TEXT,
    "location" TEXT NOT NULL,
    "distanceKm" DECIMAL(6,2),
    "houseType" TEXT,
    "usableAreaSqm" DECIMAL(10,2),
    "priceMin" DECIMAL(15,2) NOT NULL,
    "priceMax" DECIMAL(15,2) NOT NULL,
    "unitsTotal" INTEGER,
    "unitsSold" INTEGER,
    "launchDate" TIMESTAMP(3),
    "promotion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_comparables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_analysis_reports" (
    "id" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "ownPricePerSqm" DECIMAL(12,2),
    "ownPromotion" TEXT,
    "positioning" "MarketPositioning",
    "positioningScore" DECIMAL(5,2),
    "summary" TEXT,
    "recommendations" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_analysis_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_analysis_reports_costCenterId_key" ON "market_analysis_reports"("costCenterId");

-- AddForeignKey
ALTER TABLE "market_comparables" ADD CONSTRAINT "market_comparables_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_analysis_reports" ADD CONSTRAINT "market_analysis_reports_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

