-- CreateEnum
CREATE TYPE "FeasibilityCostCategory" AS ENUM ('LAND', 'CONSTRUCTION', 'INFRASTRUCTURE', 'OVERHEAD', 'FINANCING');

-- CreateTable
CREATE TABLE "feasibility_cost_items" (
    "id" TEXT NOT NULL,
    "feasibilityId" TEXT NOT NULL,
    "category" "FeasibilityCostCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feasibility_cost_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "feasibility_cost_items" ADD CONSTRAINT "feasibility_cost_items_feasibilityId_fkey" FOREIGN KEY ("feasibilityId") REFERENCES "project_feasibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable (add new header columns first, old cost columns stay in place for now)
ALTER TABLE "project_feasibility"
ADD COLUMN     "corporateTaxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "equityAmount" DECIMAL(15,2);

-- DataMigration: carry any existing per-unit flat costs into itemized cost rows
-- (amount = per-unit cost x houseCount, since the old model was per-unit and the
-- new model stores project-level totals per item)
INSERT INTO "feasibility_cost_items" ("id", "feasibilityId", "category", "name", "amount", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'CONSTRUCTION', 'ต้นทุนก่อสร้าง (ย้ายจากข้อมูลเดิม)', "constructionCostPerUnit" * "houseCount", now(), now()
FROM "project_feasibility"
WHERE "constructionCostPerUnit" > 0;

INSERT INTO "feasibility_cost_items" ("id", "feasibilityId", "category", "name", "amount", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'LAND', 'ต้นทุนที่ดิน (ย้ายจากข้อมูลเดิม)', "landCostPerUnit" * "houseCount", now(), now()
FROM "project_feasibility"
WHERE "landCostPerUnit" > 0;

INSERT INTO "feasibility_cost_items" ("id", "feasibilityId", "category", "name", "amount", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'OVERHEAD', 'ต้นทุนอื่นๆ (ย้ายจากข้อมูลเดิม)', "otherCostPerUnit" * "houseCount", now(), now()
FROM "project_feasibility"
WHERE "otherCostPerUnit" > 0;

-- AlterTable (drop the now-migrated flat columns)
ALTER TABLE "project_feasibility"
DROP COLUMN "constructionCostPerUnit",
DROP COLUMN "landCostPerUnit",
DROP COLUMN "otherCostPerUnit";
