-- AlterTable
ALTER TABLE "material_items" ADD COLUMN     "feasibilityCategory" "FeasibilityCostCategory" NOT NULL DEFAULT 'CONSTRUCTION',
ADD COLUMN     "laborUnitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "materialUnitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0;
