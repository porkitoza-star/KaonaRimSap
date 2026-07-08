# ระบบ ERP ก้าวหน้า อสังหาริมทรัพย์ จำกัด (Phase 0-1)

ระบบบริหารการเงินและบัญชีสำหรับธุรกิจก่อสร้างบ้านขาย/อสังหาริมทรัพย์ รอบนี้ครอบคลุมเฉพาะ **Phase 0-1**:

- Auth + RBAC (CEO/CFO/ACCOUNTANT/PROJECT_MANAGER/VIEWER) — สมัครสมาชิกเองได้ (ได้สิทธิ์ "ดูอย่างเดียว" ก่อน, CEO ปรับสิทธิ์ทีหลังได้), เปลี่ยนรหัสผ่าน, แก้ไขชื่อ/อัปโหลดรูปโปรไฟล์ได้เอง
- ผังบัญชี (Chart of Accounts) + Cost Center แบบลำดับชั้น (โครงการ → บ้านแต่ละหลัง)
- ระบบบัญชีคู่ (double-entry) อัตโนมัติ
- รับเงิน-จ่ายเงิน (AR/AP) พร้อมออกเอกสาร — นำเข้าจากไฟล์ Excel (bulk import) ได้ นอกจากกรอกทีละรายการ
- อัปโหลดเอกสาร + OCR อ่านบิล/ใบกำกับภาษีด้วย Claude Vision — ถ่ายรูปแล้วระบบอ่านเลขที่เอกสาร/คู่ค้า/ยอดเงินให้อัตโนมัติ ผู้ตรวจสอบเลือก Cost Center/บัญชี/หมวดงานแล้วยืนยันเพื่อสร้างบิลได้ทันที
- วัสดุก่อสร้าง (BOQ) ต่อ Cost Center + สต๊อกวัสดุ (รับเข้า/เบิกใช้/ปรับปรุงยอด) พร้อมแจ้งเตือนเมื่อถึงจุดสั่งซื้อเพิ่ม — ผู้ใช้กรอกรายการ/ปริมาณเองตามมาตรฐานจริงของแต่ละโครงการ (ระบบไม่มีค่ามาตรฐานในตัว)
- ขั้นตอนงานก่อสร้าง (เทมเพลตชื่อ/ลำดับขั้นตอนสำหรับบ้านชั้นเดียวและบ้านสองชั้น รวมรั้ว/โรงจอดรถ/ต่อเติมครัว) + Timeline แผนเทียบจริงต่อขั้นตอน คำนวณ Lead Time จากวันที่จริงที่บันทึกไว้ (ไม่ใช่ค่าประมาณการ) + กราฟสะสมมูลค่างาน (S-Curve แผนเทียบจริง) จากมูลค่างาน (บาท) ที่กรอกต่อขั้นตอน + งวดงานการชำระเงิน (Payment Milestones) บันทึกยอดที่ต้องเรียกเก็บ วันครบกำหนด และวันที่รับเงินจริงต่อบ้าน + ตารางคำนวณ Feasibility แบบละเอียดต่อโครงการ — กรอกต้นทุนเป็นรายการย่อยแยกหมวด (ที่ดิน/ก่อสร้าง/สาธารณูปโภคส่วนกลาง/ค่าใช้จ่ายโครงการ/ต้นทุนทางการเงิน) พร้อมคำนวณ Gross Profit, EBIT, EBT, Net Profit, ROS, ROI, ROE (ผู้ใช้กรอกรายการ/จำนวนเงินจริงเอง ระบบไม่มีค่ามาตรฐานในตัว)
- Dashboard การเงินพื้นฐาน (เงินสดคงเหลือ, AR/AP Aging, P&L ต่อ Cost Center, กระแสเงินสด 90 วัน) + กราฟรายรับ-รายจ่ายรายเดือน และตารางรายจ่ายแยกตามหมวดงาน (จากบิล/ใบแจ้งหนี้ที่บันทึกในระบบ แทนการทำบัญชีมือใน Excel)
- ใบหัก ณ ที่จ่าย พร้อม export CSV สำหรับยื่นสรรพากรเอง

โมดูลก่อสร้าง/ขาย/HR, LINE OA webhook จริง และ e-Filing ตรงกับสรรพากร **อยู่นอกขอบเขตของรอบนี้**

## โครงสร้างโปรเจกต์

```
apps/backend/    NestJS + Prisma + PostgreSQL (REST API)
apps/frontend/   Next.js (App Router) + Tailwind CSS — PWA
packages/        ที่ว่างไว้สำหรับ shared types ในอนาคต
render.yaml       Render Blueprint สำหรับ deploy backend (frontend deploy บน Vercel, database บน Neon)
```

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS (PWA) |
| Backend | NestJS (REST API) |
| Database | PostgreSQL ผ่าน Prisma ORM |
| Auth | JWT + bcrypt (RBAC in-house) |
| OCR/AI | Anthropic Claude API (vision) |
| File Storage | Local disk / Render Persistent Disk (ออกแบบให้ย้ายไป Cloudflare R2 ได้ในอนาคต) |
| Deploy | Vercel (frontend) + Render (backend) + Neon (Postgres) — ทุกส่วนใช้ free tier ได้ |

## เริ่มต้นใช้งานบนเครื่อง (Local Development)

### สิ่งที่ต้องมีก่อน

- Node.js 20.9+ (แนะนำ 22)
- pnpm (`corepack enable` หรือ `npm install -g pnpm`)
- PostgreSQL 14+ (รันอยู่ในเครื่องหรือ container ก็ได้)

### ขั้นตอน

1. ติดตั้ง dependencies ทั้ง monorepo จาก root:

   ```bash
   pnpm install
   ```

2. สร้างฐานข้อมูล Postgres และไฟล์ env ของ backend:

   ```bash
   createdb kaonaa_erp
   cp .env.example apps/backend/.env
   # แก้ DATABASE_URL / JWT_SECRET / ANTHROPIC_API_KEY ให้ตรงกับเครื่องของคุณ
   ```

3. รัน migration และ seed ข้อมูลตัวอย่าง (ผังบัญชีมาตรฐาน + user CEO/CFO):

   ```bash
   pnpm --filter backend prisma:migrate
   pnpm --filter backend prisma:seed
   ```

   Seed จะสร้างผู้ใช้ตัวอย่าง 2 คน:

   | อีเมล | บทบาท | รหัสผ่านเริ่มต้น |
   |---|---|---|
   | ceo@kaonaa.co.th | CEO | ChangeMe123! |
   | cfo@kaonaa.co.th | CFO | ChangeMe123! |

   > **เปลี่ยนรหัสผ่านทันทีหลังใช้งานจริงครั้งแรก** (ยังไม่มีหน้าเปลี่ยนรหัสผ่านใน Phase 0-1 — ทำผ่าน `pnpm --filter backend prisma:seed` ซ้ำด้วย `SEED_DEFAULT_PASSWORD` คนละค่า หรืออัปเดตตรงในฐานข้อมูล)

4. สร้างไฟล์ env ของ frontend:

   ```bash
   echo 'NEXT_PUBLIC_API_URL="http://localhost:3001/api"' > apps/frontend/.env.local
   ```

5. รันทั้งสองฝั่งพร้อมกัน (คนละ terminal):

   ```bash
   pnpm dev:backend    # http://localhost:3001/api
   pnpm dev:frontend   # http://localhost:3000
   ```

6. เปิด http://localhost:3000 แล้ว login ด้วยบัญชีตัวอย่างด้านบน

## Environment Variables

### Backend (`apps/backend/.env`)

| ตัวแปร | คำอธิบาย | บังคับ |
|---|---|---|
| `DATABASE_URL` | connection string ของ PostgreSQL | ใช่ |
| `JWT_SECRET` | secret สำหรับเซ็น JWT (สุ่มค่ายาว ๆ) — **ระบบจะไม่ยอมสตาร์ทถ้าไม่ตั้งค่านี้** | ใช่ |
| `ANTHROPIC_API_KEY` | API key ของ Anthropic สำหรับ OCR (Claude Vision) | ไม่ (ถ้าไม่ตั้งค่า อัปโหลดเอกสารยังทำได้ แต่จะไม่มีการอ่านค่าอัตโนมัติ ต้องกรอกเองตอนตรวจสอบ) |
| `CLAUDE_OCR_MODEL` | ชื่อโมเดลที่ใช้อ่าน OCR | ไม่ (ค่าเริ่มต้น `claude-sonnet-5`) |
| `PORT` | พอร์ตที่ backend รัน | ไม่ (ค่าเริ่มต้น 3001; บน Render จะถูก override โดยอัตโนมัติ) |
| `CEO_APPROVAL_THRESHOLD_THB` | วงเงินจ่ายที่เกินแล้วต้องให้ CEO อนุมัติซ้ำ | ไม่ (ค่าเริ่มต้น 50,000) |
| `DOCUMENTS_STORAGE_PATH` | โฟลเดอร์เก็บไฟล์เอกสารที่อัปโหลด | ไม่ (ค่าเริ่มต้น `./uploads`) |
| `FRONTEND_URL` | URL ของ frontend ที่อนุญาตให้เรียก API ข้าม origin ได้ (CORS) | ไม่ (ถ้าไม่ตั้งค่าจะอนุญาตทุก origin — ควรตั้งค่าเมื่อ deploy จริง) |

### Frontend (`apps/frontend/.env.local`)

| ตัวแปร | คำอธิบาย |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL ของ backend API (รวม `/api`) |

## Deploy ขึ้นจริง (Vercel + Render + Neon — ฟรีทั้งหมด ไม่ผูกบัตร)

เพราะโควต้าฟรีของ Render อย่างเดียวไม่พอ (750 ชม./เดือน ใช้ร่วมกันทุก service + Postgres ฟรีหมดอายุใน 30 วัน) จึงแยกงานเป็น 3 ที่ ซึ่งแต่ละที่ฟรีแบบไม่มีวันหมดอายุ:

- **Neon** — ฐานข้อมูล Postgres
- **Render** — backend (NestJS) เท่านั้น ([`render.yaml`](./render.yaml))
- **Vercel** — frontend (Next.js)

### 1) สร้างฐานข้อมูลบน Neon

1. สมัคร/ล็อกอิน https://neon.tech (ฟรี ไม่ต้องผูกบัตร)
2. สร้าง Project ใหม่ ตั้งชื่อ เช่น `kaonaa-erp`
3. ในหน้า Dashboard ของ project กด **Connection Details** แล้วคัดลอก connection string ที่ขึ้นต้นด้วย `postgresql://...` (เลือกแบบ "Pooled connection")
4. เก็บค่านี้ไว้ — จะใช้เป็น `DATABASE_URL` ในขั้นตอนถัดไป

### 2) Deploy backend บน Render

1. เข้า [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
2. เลือก repository `KaonaRimSap` (branch `main`) — Render จะอ่าน `render.yaml` และเจอ service เดียวคือ `kaonaa-erp-backend`
3. กด **Apply**
4. Render จะรอให้กรอก environment variable ที่ทำเครื่องหมาย `sync: false` ไว้ — เข้าไปที่ service `kaonaa-erp-backend` → **Environment** แล้วใส่:
   - `DATABASE_URL` = connection string จาก Neon ที่คัดลอกไว้
   - `ANTHROPIC_API_KEY` = API key จาก https://console.anthropic.com (ถ้ายังไม่มี ข้ามได้ก่อน แค่ OCR จะไม่ทำงาน)
   - `FRONTEND_URL` = ใส่ URL ของ Vercel (ทำขั้นตอนที่ 3 ก่อนแล้วค่อยกลับมาใส่ค่านี้ก็ได้)
5. รอ build เสร็จ — `startCommand` จะรัน `prisma migrate deploy` แล้ว seed ข้อมูลเริ่มต้น (ผังบัญชีมาตรฐาน + user CEO/CFO ตัวอย่าง) อัตโนมัติทุกครั้งที่ deploy โดยไม่ต้องเข้า Shell (Free plan ของ Render ไม่รองรับ Shell/SSH อยู่แล้ว) — seed script เขียนแบบ upsert จึงรันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ
   > **เปลี่ยนรหัสผ่าน CEO/CFO ทันทีหลังใช้งานจริงครั้งแรก**
6. จด URL ของ backend ไว้ (รูปแบบ `https://kaonaa-erp-backend.onrender.com`) — ใช้ในขั้นตอนถัดไป

### 3) Deploy frontend บน Vercel

1. สมัคร/ล็อกอิน https://vercel.com ด้วยบัญชี GitHub เดียวกัน (ฟรี ไม่ต้องผูกบัตร)
2. **Add New** → **Project** → เลือก repository `KaonaRimSap`
3. ในหน้าตั้งค่าก่อน deploy: กด **Edit** ที่ **Root Directory** แล้วเลือก `apps/frontend` (Vercel จะตรวจพบว่าเป็น Next.js อัตโนมัติ)
4. เปิด **Environment Variables** เพิ่ม:
   - `NEXT_PUBLIC_API_URL` = URL ของ backend จาก Render ต่อท้ายด้วย `/api` เช่น `https://kaonaa-erp-backend.onrender.com/api`
5. กด **Deploy**
6. เมื่อเสร็จ Vercel จะให้ URL มา (เช่น `https://kaonarimsap.vercel.app`) — นำ URL นี้กลับไปใส่เป็นค่า `FRONTEND_URL` ในขั้นตอนที่ 2 ของฝั่ง Render (ถ้ายังไม่ได้ใส่) แล้วกด **Manual Deploy** ที่ Render อีกครั้งเพื่อให้ CORS อนุญาต origin นี้

### 4) เข้าใช้งาน

เปิด URL ของ Vercel จากมือถือหรือคอมพิวเตอร์ แล้ว login ด้วยบัญชีตัวอย่าง (`ceo@kaonaa.co.th` / `ChangeMe123!`) — บนมือถือกด "เพิ่มลงหน้าจอโฮม" (Add to Home Screen) เพื่อใช้งานแบบแอปได้เลยเพราะเป็น PWA

### หมายเหตุสำคัญ

- Render free plan จะ sleep เมื่อไม่มีการใช้งานสักพัก (โหลดครั้งแรกหลัง sleep จะช้าประมาณ 30-60 วินาที) และไม่รองรับ Persistent Disk ทำให้ไฟล์เอกสารที่อัปโหลดเก็บไว้ในดิสก์ชั่วคราวของ container เท่านั้น (อาจหายเมื่อ redeploy/restart) — เหมาะสำหรับทดสอบใช้งานก่อน เมื่อพร้อมใช้งานจริงแนะนำอัปเกรดเป็น `starter` plan
- `JWT_SECRET` ถูกสุ่มให้อัตโนมัติโดย Render (`generateValue: true`) ไม่ต้องตั้งเอง
- Neon free tier ไม่มีวันหมดอายุ แต่มี storage จำกัด (0.5GB) และ compute จะ auto-suspend เมื่อไม่มีการใช้งาน (จะปลุกอัตโนมัติเมื่อมี request เข้ามา อาจช้าสักครู่ในการเชื่อมต่อครั้งแรก)

## ขอบเขตที่ยังไม่ทำ (นอก Phase 0-1)

Timeline/Gantt ลำดับขั้นตอนก่อสร้างและกำหนดการสั่งซื้อวัสดุอัตโนมัติ, CRM ขาย/นายหน้า/เช่า, HR/เงินเดือน, LINE OA webhook จริง, e-Filing สรรพากรแบบเชื่อมต่อ API ตรง (ปัจจุบันทำได้แค่ export CSV ไปยื่นเอง) — โครงสร้างฐานข้อมูลออกแบบให้รองรับการขยายไปโมดูลเหล่านี้ได้โดยไม่ต้องแก้ schema เดิม
