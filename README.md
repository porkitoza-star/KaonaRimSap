# ระบบ ERP ก้าวหน้า อสังหาริมทรัพย์ จำกัด (Phase 0-1)

ระบบบริหารการเงินและบัญชีสำหรับธุรกิจก่อสร้างบ้านขาย/อสังหาริมทรัพย์ รอบนี้ครอบคลุมเฉพาะ **Phase 0-1**:

- Auth + RBAC (CEO/CFO/ACCOUNTANT/PROJECT_MANAGER/VIEWER)
- ผังบัญชี (Chart of Accounts) + Cost Center แบบลำดับชั้น (โครงการ → บ้านแต่ละหลัง)
- ระบบบัญชีคู่ (double-entry) อัตโนมัติ
- รับเงิน-จ่ายเงิน (AR/AP) พร้อมออกเอกสาร
- อัปโหลดเอกสาร + OCR อ่านบิล/ใบกำกับภาษีด้วย Claude Vision
- Dashboard การเงินพื้นฐาน (เงินสดคงเหลือ, AR/AP Aging, P&L ต่อ Cost Center, กระแสเงินสด 90 วัน)
- ใบหัก ณ ที่จ่าย พร้อม export CSV สำหรับยื่นสรรพากรเอง

โมดูลก่อสร้าง/ขาย/HR, LINE OA webhook จริง และ e-Filing ตรงกับสรรพากร **อยู่นอกขอบเขตของรอบนี้**

## โครงสร้างโปรเจกต์

```
apps/backend/    NestJS + Prisma + PostgreSQL (REST API)
apps/frontend/   Next.js (App Router) + Tailwind CSS — PWA
packages/        ที่ว่างไว้สำหรับ shared types ในอนาคต
render.yaml       Render Blueprint สำหรับ deploy backend + frontend + Postgres
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
| Deploy | Render (Web Service backend + frontend, Render Postgres) |

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
| `JWT_SECRET` | secret สำหรับเซ็น JWT (สุ่มค่ายาว ๆ) | ใช่ |
| `ANTHROPIC_API_KEY` | API key ของ Anthropic สำหรับ OCR (Claude Vision) | ไม่ (ถ้าไม่ตั้งค่า อัปโหลดเอกสารยังทำได้ แต่จะไม่มีการอ่านค่าอัตโนมัติ ต้องกรอกเองตอนตรวจสอบ) |
| `CLAUDE_OCR_MODEL` | ชื่อโมเดลที่ใช้อ่าน OCR | ไม่ (ค่าเริ่มต้น `claude-sonnet-5`) |
| `PORT` | พอร์ตที่ backend รัน | ไม่ (ค่าเริ่มต้น 3001; บน Render จะถูก override โดยอัตโนมัติ) |
| `CEO_APPROVAL_THRESHOLD_THB` | วงเงินจ่ายที่เกินแล้วต้องให้ CEO อนุมัติซ้ำ | ไม่ (ค่าเริ่มต้น 50,000) |
| `DOCUMENTS_STORAGE_PATH` | โฟลเดอร์เก็บไฟล์เอกสารที่อัปโหลด | ไม่ (ค่าเริ่มต้น `./uploads`) |

### Frontend (`apps/frontend/.env.local`)

| ตัวแปร | คำอธิบาย |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL ของ backend API (รวม `/api`) |

## Deploy ขึ้น Render

โปรเจกต์นี้มี [`render.yaml`](./render.yaml) เป็น Blueprint พร้อมใช้งาน ประกอบด้วย:

- **kaonaa-erp-backend** — Web Service (NestJS) พร้อม Persistent Disk สำหรับเก็บไฟล์เอกสารที่อัปโหลด
- **kaonaa-erp-frontend** — Web Service (Next.js)
- **kaonaa-erp-db** — Render Postgres

### ขั้นตอน Deploy

1. Push โค้ดขึ้น GitHub (ทำแล้วในรอบนี้)
2. เข้า [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. เลือก repository นี้ Render จะอ่าน `render.yaml` และแสดงรายการ services ทั้งหมดให้ยืนยัน
4. กด **Apply** — Render จะสร้าง Postgres, backend, และ frontend ให้อัตโนมัติ
5. **ตั้งค่า environment variable ที่ต้องกรอกเอง** (Render จะรอค่านี้ก่อนเริ่ม deploy backend):
   - เข้าไปที่ service `kaonaa-erp-backend` → **Environment** → ใส่ `ANTHROPIC_API_KEY` (ขอ API key ได้จาก https://console.anthropic.com)
6. รอ build เสร็จ (backend จะรัน `prisma migrate deploy` อัตโนมัติทุกครั้งที่ deploy)
7. **Seed ข้อมูลเริ่มต้นครั้งแรก** — เข้า service `kaonaa-erp-backend` → แท็บ **Shell** แล้วรัน:

   ```bash
   pnpm --filter backend prisma:seed
   ```

   (สร้างผังบัญชีมาตรฐาน + user CEO/CFO ตัวอย่าง เหมือนตอน local — **เปลี่ยนรหัสผ่านทันที**)

8. ตรวจสอบว่า frontend เรียก backend ถูก URL — ค่าเริ่มต้นใน `render.yaml` อ้างอิงชื่อ service `kaonaa-erp-backend.onrender.com`; ถ้าเปลี่ยนชื่อ service หรือใช้ custom domain ต้องแก้ `NEXT_PUBLIC_API_URL` ใน service `kaonaa-erp-frontend` → **Environment** แล้ว deploy frontend ใหม่ (ค่านี้ถูก build เข้าไปใน bundle ตอน build time)
9. เข้าใช้งานผ่าน URL ของ `kaonaa-erp-frontend` ที่ Render สร้างให้

### หมายเหตุสำคัญ

- ไฟล์เอกสารที่อัปโหลดเก็บบน Persistent Disk ของ Render (path `/var/data/uploads`) — ขนาดเริ่มต้น 1GB ปรับเพิ่มได้ที่ dashboard เมื่อใกล้เต็ม
- `render.yaml` ตั้ง plan เป็น `starter` ทั้งหมด (มีค่าใช้จ่าย) — เปลี่ยนเป็น `free` ได้ถ้าต้องการทดสอบก่อน แต่ free plan ของ Render จะ sleep เมื่อไม่มีการใช้งานและไม่รองรับ Persistent Disk
- `JWT_SECRET` ถูกสุ่มให้อัตโนมัติโดย Render (`generateValue: true`) ไม่ต้องตั้งเอง

## ขอบเขตที่ยังไม่ทำ (นอก Phase 0-1)

Timeline/Gantt ก่อสร้าง, จัดซื้อวัสดุ/BOQ, CRM ขาย/นายหน้า/เช่า, HR/เงินเดือน, LINE OA webhook จริง, e-Filing สรรพากรแบบเชื่อมต่อ API ตรง (ปัจจุบันทำได้แค่ export CSV ไปยื่นเอง) — โครงสร้างฐานข้อมูลออกแบบให้รองรับการขยายไปโมดูลเหล่านี้ได้โดยไม่ต้องแก้ schema เดิม
