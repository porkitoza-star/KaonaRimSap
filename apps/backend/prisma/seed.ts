import { PrismaClient, AccountType, CostCenterType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const chartOfAccounts: {
  code: string;
  name: string;
  type: AccountType;
  parentCode?: string;
}[] = [
  // สินทรัพย์
  { code: '1000', name: 'สินทรัพย์หมุนเวียน', type: AccountType.ASSET },
  { code: '1010', name: 'เงินสด', type: AccountType.ASSET, parentCode: '1000' },
  { code: '1020', name: 'เงินฝากธนาคาร', type: AccountType.ASSET, parentCode: '1000' },
  { code: '1030', name: 'ลูกหนี้การค้า', type: AccountType.ASSET, parentCode: '1000' },
  {
    code: '1040',
    name: 'ที่ดินและต้นทุนโครงการระหว่างก่อสร้าง',
    type: AccountType.ASSET,
    parentCode: '1000',
  },
  { code: '1050', name: 'วัสดุก่อสร้างคงเหลือ', type: AccountType.ASSET, parentCode: '1000' },
  { code: '1060', name: 'ภาษีซื้อรอขอคืน', type: AccountType.ASSET, parentCode: '1000' },
  { code: '1500', name: 'สินทรัพย์ไม่หมุนเวียน', type: AccountType.ASSET },
  { code: '1510', name: 'อุปกรณ์สำนักงาน', type: AccountType.ASSET, parentCode: '1500' },
  { code: '1520', name: 'ยานพาหนะ', type: AccountType.ASSET, parentCode: '1500' },

  // หนี้สิน
  { code: '2000', name: 'หนี้สินหมุนเวียน', type: AccountType.LIABILITY },
  { code: '2010', name: 'เจ้าหนี้การค้า', type: AccountType.LIABILITY, parentCode: '2000' },
  { code: '2020', name: 'ภาษีขาย (VAT ขาย)', type: AccountType.LIABILITY, parentCode: '2000' },
  {
    code: '2030',
    name: 'ภาษีหัก ณ ที่จ่ายค้างนำส่ง',
    type: AccountType.LIABILITY,
    parentCode: '2000',
  },
  { code: '2040', name: 'เงินกู้ยืมระยะสั้น', type: AccountType.LIABILITY, parentCode: '2000' },
  { code: '2500', name: 'หนี้สินไม่หมุนเวียน', type: AccountType.LIABILITY },
  {
    code: '2510',
    name: 'เงินกู้ยืมระยะยาว',
    type: AccountType.LIABILITY,
    parentCode: '2500',
  },

  // ส่วนของเจ้าของ
  { code: '3000', name: 'ส่วนของเจ้าของ', type: AccountType.EQUITY },
  { code: '3010', name: 'ทุนจดทะเบียน', type: AccountType.EQUITY, parentCode: '3000' },
  { code: '3020', name: 'กำไรสะสม', type: AccountType.EQUITY, parentCode: '3000' },

  // รายได้
  { code: '4000', name: 'รายได้', type: AccountType.REVENUE },
  {
    code: '4010',
    name: 'รายได้จากการขายบ้าน/ที่ดิน',
    type: AccountType.REVENUE,
    parentCode: '4000',
  },
  { code: '4020', name: 'รายได้อื่น', type: AccountType.REVENUE, parentCode: '4000' },

  // ค่าใช้จ่าย
  { code: '5000', name: 'ต้นทุนขาย', type: AccountType.EXPENSE },
  { code: '5010', name: 'ต้นทุนค่าก่อสร้าง', type: AccountType.EXPENSE, parentCode: '5000' },
  { code: '5020', name: 'ต้นทุนที่ดิน', type: AccountType.EXPENSE, parentCode: '5000' },
  { code: '6000', name: 'ค่าใช้จ่ายในการขายและบริหาร', type: AccountType.EXPENSE },
  { code: '6010', name: 'เงินเดือนพนักงาน', type: AccountType.EXPENSE, parentCode: '6000' },
  { code: '6020', name: 'ค่าเช่าสำนักงาน', type: AccountType.EXPENSE, parentCode: '6000' },
  { code: '6030', name: 'ค่าสาธารณูปโภค', type: AccountType.EXPENSE, parentCode: '6000' },
  { code: '6040', name: 'ค่าการตลาดและโฆษณา', type: AccountType.EXPENSE, parentCode: '6000' },
  { code: '6050', name: 'ค่าเสื่อมราคา', type: AccountType.EXPENSE, parentCode: '6000' },
  { code: '6060', name: 'ค่าใช้จ่ายเบ็ดเตล็ด', type: AccountType.EXPENSE, parentCode: '6000' },
];

async function seedChartOfAccounts() {
  const idByCode = new Map<string, string>();
  for (const acc of chartOfAccounts.filter((a) => !a.parentCode)) {
    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: { code: acc.code, name: acc.name, type: acc.type },
    });
    idByCode.set(acc.code, created.id);
  }
  for (const acc of chartOfAccounts.filter((a) => a.parentCode)) {
    const created = await prisma.account.upsert({
      where: { code: acc.code },
      update: {},
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        parentId: idByCode.get(acc.parentCode!),
      },
    });
    idByCode.set(acc.code, created.id);
  }
  console.log(`Seeded ${chartOfAccounts.length} chart of accounts entries.`);
}

async function seedCostCenters() {
  const overhead = await prisma.costCenter.upsert({
    where: { id: 'seed-overhead' },
    update: {},
    create: {
      id: 'seed-overhead',
      name: 'ค่าใช้จ่ายส่วนกลาง (Overhead)',
      type: CostCenterType.OVERHEAD,
    },
  });

  const project = await prisma.costCenter.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      name: 'โครงการนำร่อง (ตัวอย่าง)',
      type: CostCenterType.PROJECT,
    },
  });

  await prisma.costCenter.upsert({
    where: { id: 'seed-house-1' },
    update: {},
    create: {
      id: 'seed-house-1',
      name: 'บ้านเลขที่ 1 (ตัวอย่าง)',
      type: CostCenterType.HOUSE,
      parentId: project.id,
    },
  });

  console.log(`Seeded cost centers: ${overhead.name}, ${project.name}, and 1 house.`);
}

async function seedUsers() {
  const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  await prisma.user.upsert({
    where: { email: 'ceo@kaonaa.co.th' },
    update: { name: 'ทศพล พรมยิ่ง' },
    create: {
      name: 'ทศพล พรมยิ่ง',
      email: 'ceo@kaonaa.co.th',
      passwordHash,
      role: Role.CEO,
    },
  });

  await prisma.user.upsert({
    where: { email: 'cfo@kaonaa.co.th' },
    update: { name: 'เมวิกา พรมยิ่ง' },
    create: {
      name: 'เมวิกา พรมยิ่ง',
      email: 'cfo@kaonaa.co.th',
      passwordHash,
      role: Role.CFO,
    },
  });

  console.log(
    `Seeded users ceo@kaonaa.co.th / cfo@kaonaa.co.th with password "${defaultPassword}" (change after first login).`,
  );
}

async function main() {
  await seedChartOfAccounts();
  await seedCostCenters();
  await seedUsers();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
