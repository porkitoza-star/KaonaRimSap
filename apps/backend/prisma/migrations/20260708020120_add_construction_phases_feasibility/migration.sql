-- CreateTable
CREATE TABLE "construction_phases" (
    "id" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "percentComplete" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "construction_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_feasibility" (
    "id" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "houseCount" INTEGER NOT NULL DEFAULT 1,
    "constructionCostPerUnit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "landCostPerUnit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "otherCostPerUnit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sellingPricePerUnit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_feasibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_feasibility_costCenterId_key" ON "project_feasibility"("costCenterId");

-- AddForeignKey
ALTER TABLE "construction_phases" ADD CONSTRAINT "construction_phases_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_feasibility" ADD CONSTRAINT "project_feasibility_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
