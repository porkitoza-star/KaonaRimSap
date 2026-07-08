export type HouseTemplateType = 'SINGLE_STORY' | 'TWO_STORY';

export interface PhaseTemplateItem {
  sequence: number;
  category: string;
  name: string;
}

/**
 * Generic phase name/order templates for a typical Thai residential build.
 * These are organizational only (no durations, quantities, or costs) — every
 * project's actual schedule varies by contractor/site, so plan dates and
 * progress are entered by the user, not estimated here.
 */
export const PHASE_TEMPLATES: Record<HouseTemplateType, PhaseTemplateItem[]> = {
  SINGLE_STORY: [
    { sequence: 1, category: 'งานเตรียมการ', name: 'ขออนุญาตก่อสร้าง / สำรวจพื้นที่' },
    { sequence: 2, category: 'งานฐานราก', name: 'ตอกเสาเข็ม / งานดิน' },
    { sequence: 3, category: 'งานฐานราก', name: 'หล่อฐานราก / คานคอดิน' },
    { sequence: 4, category: 'งานโครงสร้าง', name: 'งานเสา-คาน โครงสร้างหลัก' },
    { sequence: 5, category: 'งานโครงสร้าง', name: 'งานพื้น / โครงสร้างหลังคา' },
    { sequence: 6, category: 'งานหลังคา', name: 'มุงหลังคา' },
    { sequence: 7, category: 'งานสถาปัตยกรรม', name: 'ก่อผนัง' },
    { sequence: 8, category: 'งานสถาปัตยกรรม', name: 'ฉาบปูน' },
    { sequence: 9, category: 'งานระบบ', name: 'เดินท่อประปา / สุขาภิบาล' },
    { sequence: 10, category: 'งานระบบ', name: 'เดินสายไฟฟ้า' },
    { sequence: 11, category: 'งานสถาปัตยกรรม', name: 'ปูกระเบื้อง / พื้นผิว' },
    { sequence: 12, category: 'งานสถาปัตยกรรม', name: 'ติดตั้งวงกบ ประตู หน้าต่าง' },
    { sequence: 13, category: 'งานสถาปัตยกรรม', name: 'งานฝ้าเพดาน' },
    { sequence: 14, category: 'งานตกแต่ง', name: 'ทาสีภายใน-ภายนอก' },
    { sequence: 15, category: 'งานตกแต่ง', name: 'ติดตั้งสุขภัณฑ์ / เครื่องใช้ไฟฟ้า' },
    { sequence: 16, category: 'งานภายนอก', name: 'รั้ว / กำแพง' },
    { sequence: 17, category: 'งานภายนอก', name: 'โรงจอดรถ' },
    { sequence: 18, category: 'งานภายนอก', name: 'ต่อเติมครัวหลังบ้าน' },
    { sequence: 19, category: 'งานภายนอก', name: 'ถมดิน / ตกแต่งภูมิทัศน์' },
    { sequence: 20, category: 'งานส่งมอบ', name: 'ทำความสะอาดก่อนส่งมอบ' },
    { sequence: 21, category: 'งานส่งมอบ', name: 'ตรวจสอบและส่งมอบบ้าน' },
  ],
  TWO_STORY: [
    { sequence: 1, category: 'งานเตรียมการ', name: 'ขออนุญาตก่อสร้าง / สำรวจพื้นที่' },
    { sequence: 2, category: 'งานฐานราก', name: 'ตอกเสาเข็ม / งานดิน' },
    { sequence: 3, category: 'งานฐานราก', name: 'หล่อฐานราก / คานคอดิน' },
    { sequence: 4, category: 'งานโครงสร้าง', name: 'งานเสา-คาน-พื้น ชั้น 1' },
    { sequence: 5, category: 'งานโครงสร้าง', name: 'งานเสา-คาน-พื้น ชั้น 2' },
    { sequence: 6, category: 'งานโครงสร้าง', name: 'งานโครงสร้างหลังคา' },
    { sequence: 7, category: 'งานหลังคา', name: 'มุงหลังคา' },
    { sequence: 8, category: 'งานสถาปัตยกรรม', name: 'ก่อผนัง ชั้น 1' },
    { sequence: 9, category: 'งานสถาปัตยกรรม', name: 'ก่อผนัง ชั้น 2' },
    { sequence: 10, category: 'งานสถาปัตยกรรม', name: 'ฉาบปูน ชั้น 1-2' },
    { sequence: 11, category: 'งานโครงสร้าง', name: 'หล่อ / ติดตั้งบันได' },
    { sequence: 12, category: 'งานระบบ', name: 'เดินท่อประปา / สุขาภิบาล ชั้น 1-2' },
    { sequence: 13, category: 'งานระบบ', name: 'เดินสายไฟฟ้า ชั้น 1-2' },
    { sequence: 14, category: 'งานสถาปัตยกรรม', name: 'ปูกระเบื้อง / พื้นผิว ชั้น 1-2' },
    { sequence: 15, category: 'งานสถาปัตยกรรม', name: 'ติดตั้งวงกบ ประตู หน้าต่าง' },
    { sequence: 16, category: 'งานสถาปัตยกรรม', name: 'งานฝ้าเพดาน' },
    { sequence: 17, category: 'งานตกแต่ง', name: 'ทาสีภายใน-ภายนอก' },
    { sequence: 18, category: 'งานตกแต่ง', name: 'ติดตั้งสุขภัณฑ์ / เครื่องใช้ไฟฟ้า' },
    { sequence: 19, category: 'งานภายนอก', name: 'รั้ว / กำแพง' },
    { sequence: 20, category: 'งานภายนอก', name: 'โรงจอดรถ' },
    { sequence: 21, category: 'งานภายนอก', name: 'ต่อเติมครัวหลังบ้าน' },
    { sequence: 22, category: 'งานภายนอก', name: 'ถมดิน / ตกแต่งภูมิทัศน์' },
    { sequence: 23, category: 'งานส่งมอบ', name: 'ทำความสะอาดก่อนส่งมอบ' },
    { sequence: 24, category: 'งานส่งมอบ', name: 'ตรวจสอบและส่งมอบบ้าน' },
  ],
};
