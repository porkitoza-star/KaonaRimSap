export type EstimatorGrade = 'STANDARD' | 'HIGH' | 'LUXURY' | 'PREMIUM';
export type EstimatorRoofType = 'GABLE' | 'HIP' | 'MONO_PITCH' | 'FLAT';
export type EstimatorFloors = 1 | 2 | 3;

/**
 * Baseline construction cost per sqm (material + labor) by floor count, at
 * STANDARD grade with a GABLE roof. The 1-story and 2-story figures come
 * directly from two real reference documents (a 1-story 3-bed/2-bath project
 * cost-planning sheet at 16,000 บาท/ตรม, and a 2-story 106.75 sqm itemized
 * quotation totaling 1,567,536.73 บาท = 14,684.18 บาท/ตรม). 3-story
 * extrapolates the same shared-foundation/roof economy of scale. This is a
 * planning-grade estimate, not a substitute for a contractor quote.
 */
export const BASE_RATE_PER_SQM_BY_FLOORS: Record<EstimatorFloors, number> = {
  1: 16000,
  2: 14684.18,
  3: 13950,
};

export const GRADE_MULTIPLIERS: Record<EstimatorGrade, number> = {
  STANDARD: 1.0,
  HIGH: 1.2,
  LUXURY: 1.55,
  PREMIUM: 2.0,
};

export const GRADE_LABELS: Record<EstimatorGrade, string> = {
  STANDARD: 'มาตรฐาน (เฉลี่ยไทวัสดุ/โกลบอลเฮ้าส์)',
  HIGH: 'เกรดสูง',
  LUXURY: 'หรูหรา',
  PREMIUM: 'พรีเมียม',
};

export const ROOF_MULTIPLIERS: Record<EstimatorRoofType, number> = {
  GABLE: 1.0,
  HIP: 1.08,
  MONO_PITCH: 0.95,
  FLAT: 1.1,
};

export const ROOF_LABELS: Record<EstimatorRoofType, string> = {
  GABLE: 'ทรงจั่ว',
  HIP: 'ทรงปั้นหยา',
  MONO_PITCH: 'เพิงหมาแหงน',
  FLAT: 'ดาดฟ้า/หลังคาเรียบ',
};

/**
 * Category split of total construction cost, derived from the same real
 * 2-story reference quotation (โครงสร้าง 489,881.73 / สถาปัตย์ 897,826.00 /
 * สุขาภิบาล 62,699.00 / ไฟฟ้า 117,130.00, of a 1,567,536.73 total). Assumed
 * to hold approximately across grades/floor counts.
 */
export const CATEGORY_PROPORTIONS = {
  STRUCTURE: 0.3125,
  ARCHITECTURE: 0.5728,
  SANITARY: 0.04,
  ELECTRICAL: 0.0747,
};

export const CATEGORY_LABELS: Record<keyof typeof CATEGORY_PROPORTIONS, string> = {
  STRUCTURE: 'หมวดงานโครงสร้าง',
  ARCHITECTURE: 'หมวดงานสถาปัตย์',
  SANITARY: 'หมวดงานระบบสุขาภิบาล',
  ELECTRICAL: 'หมวดงานระบบไฟฟ้า',
};

/**
 * Share of total scenario construction cost assigned to each phase-template
 * category (see construction-phases/phase-templates.ts), used to spread the
 * scenario's contract value across a Gantt timeline. Blends the same 4
 * real category proportions above with typical prep/finishing/external
 * phases; sums to 1.0.
 */
export const PHASE_CATEGORY_WEIGHTS: Record<string, number> = {
  งานเตรียมการ: 0.01,
  งานฐานราก: 0.1,
  งานโครงสร้าง: 0.18,
  งานหลังคา: 0.05,
  งานสถาปัตยกรรม: 0.45,
  งานระบบ: 0.1,
  งานตกแต่ง: 0.08,
  งานภายนอก: 0.02,
  งานส่งมอบ: 0.01,
};

/**
 * Rough duration estimate (months) for the Gantt/timeline scenario: a base
 * duration for a small single-story house, +1 month per additional floor,
 * +1 month per every 40 sqm beyond the first 60 sqm. Every real project
 * varies with contractor/site — this is a planning starting point only.
 */
export function estimateDurationMonths(areaSqm: number, floors: EstimatorFloors): number {
  const base = 4;
  const floorAddOn = (floors - 1) * 1.5;
  const areaAddOn = Math.max(0, Math.ceil((areaSqm - 60) / 40));
  return Math.round((base + floorAddOn + areaAddOn) * 10) / 10;
}
