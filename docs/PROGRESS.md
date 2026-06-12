# PROGRESS — LINE HR AI Agent Platform

> สมุดบันทึกความคืบหน้า ลูฟี่อัปเดตไฟล์นี้ทุกครั้งที่ทำงานเสร็จแต่ละก้อน
> รูปแบบ: วันที่ · สิ่งที่ทำ · ไฟล์ที่เกี่ยวข้อง · สถานะ · สิ่งที่ต้องทำต่อ

---

## สถานะรวม
- **Phase ปัจจุบัน:** Phase 2 — **ขึ้น production ครบวงจรแล้ว! ✅** Deploy Vercel + GitHub, Rich Menu + LIFF ฟอร์มลา + webhook ทำงานบนโดเมนถาวร, Webhook Verify ผ่าน
- **ถัดไป:** **Phase 3 — Approval workflow** (อนุมัติ/ปฏิเสธคำขอลา + แจ้งเตือน) เพื่อปิดลูปการลา + หน้า dashboard รายการคำขอลาให้ HR; แล้วต่อ flow OT/ลงเวลา/เอกสาร
- **Supabase:** Singapore (aws-1 pooler) · migrations ถึง **0009** · Demo Co seeded (6 พนักงาน, admin user)
- **Login dashboard:** admin@demo.co / Demo!2026
- **อัปเดตล่าสุด:** 2026-06-12

### 🌐 Production (โดเมนถาวร — ไม่ต้องเปลี่ยนอีก)
- **GitHub:** `https://github.com/EPICCODING17/line-hr-ai-platform` (private) · workflow: แก้โค้ด → `git push` → Vercel auto-deploy
- **Vercel:** `https://line-hr-ai-platform.vercel.app`
- **Webhook URL (Messaging API channel):** `https://line-hr-ai-platform.vercel.app/api/line/webhook/d3684f40-f566-4604-b5bf-262dc4f443cd` ✅ verified
- **LIFF endpoint (LINE Login channel):** `https://line-hr-ai-platform.vercel.app/liff/leave?acct=d3684f40-f566-4604-b5bf-262dc4f443cd` · LIFF ID `2010383091-kBSUiU9b`
- **Vercel env (4 ตัว):** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, APP_ENCRYPTION_KEY
- tunnel/cloudflared **เลิกใช้แล้ว** (ใช้แค่ตอน dev local เท่านั้น)

### 2026-06-12 — Deploy GitHub + Vercel ✅
- git init + push ขึ้น GitHub (EPICCODING17) — แก้ปัญหา GCM ค้างบัญชี jakkapong-jpg (403) → ล้าง credential → login EPICCODING17
- Import Vercel + ใส่ env 4 ตัว → build ผ่าน, โดเมนถาวร
- ตั้ง Webhook URL + LIFF endpoint เป็นโดเมน Vercel → **Webhook Verify Success**
- เช็ค production: `/login` 200, `/liff/leave` 200, webhook POST→401(no sig, route alive), GET→405 — ครบ
- บั๊กที่เจอตอน setup: (1) LIFF endpoint ใส่แค่โดเมน → เด้ง /login dashboard → ต้องใส่ path `/liff/leave?acct=` ครบ (2) Webhook ใส่ path ไม่ครบ → 405 → ต้อง `/api/line/webhook/{id}` ครบ

## Roadmap checklist
- [x] **Phase 0** — Foundation DB + RLS
- [ ] **Phase 1** — Employee Core + Web Dashboard (CRUD)
- [ ] **Phase 2** — LINE + LIFF แบบ structured (Rich Menu → form, ยังไม่มี AI)
- [ ] **Phase 3** — Approval Workflow engine (configurable) + Notification
- [ ] **Phase 4** — AI layer (async webhook → intent → slot-filling → confirm)
- [ ] **Phase 5** — Payroll + Billing + PDPA

---

## บันทึกรายวัน

### 2026-06-13 — ข้อความบอตยกระดับเป็น Flex Message ✅ (impeccable)
- **`src/lib/line/flex.ts`** — builder การ์ดตามแบรนด์: ใบเสร็จลา (header เขียว + rows + pill สถานะ), รายการสถานะ (header น้ำเงิน + pill สีตามสถานะ), info/coming-soon/contact/welcome (header ไอคอนสี + ปุ่ม CTA), map สีสถานะ 7 แบบ
- แทน `textMsg` ทั้งหมดใน webhook: postback (ลา=การ์ด+ปุ่ม, สถานะ=รายการจริง, OT/ลงเวลา/เอกสาร=coming-soon, ติดต่อ=contact), follow/ผูกบัญชี=welcome; และ push ใบเสร็จตอน submit LIFF
- **บั๊กที่เจอ:** `gravity` ใช้กับ box ไม่ได้ (เฉพาะ text/icon) → LINE 400 → เปลี่ยนเป็น `justifyContent`; กำหนด `flex` ชัดเจนกัน alignment เพี้ยน
- verify: `scripts/preview-flex.mjs` push การ์ดตัวอย่าง 5 ใบเข้าไลน์จริง → HTTP 200 + Pong อนุมัติ → deploy
- ค่าคงที่: ใบเสร็จ/สถานะ size mega, info/contact size kilo

### 2026-06-12 — LIFF ฟอร์มลา: redesign พรีเมียม ✅ (impeccable `delight`)
- Header อบอุ่น: avatar gradient (ตัวย่อชื่อ) + ทักทาย "สวัสดีคุณ…" + รหัสพนักงาน
- การ์ดประเภทลา: ไอคอน tile สีรายประเภท (annual=ดวงอาทิตย์, sick=หัวใจ, personal=คน, maternity=เด็ก, military=โล่, other=จุด) ระบายสีตาม `leave_types.color` ผ่าน `--c` + color-mix; การ์ดที่เลือก = ขอบสี + tint + check badge + ยกตัว
- Success: checkmark วาด (stroke-dashoffset) + confetti burst สีแบรนด์; พื้นหลัง radial tint บางๆ; ปุ่ม submit มีมิติ; toggle spring; reduced-motion ครบ
- คุมโทนตาม brand (มืออาชีพ+อบอุ่น ไม่การ์ตูน); tsc สะอาด; verify ด้วย screenshot (form + success) → push → Vercel auto-deploy → ยืนยัน production มี marker `type-tile/check-draw/liff-avatar` + เรนเดอร์จริง

### 2026-06-12 — Phase 2: Rich Menu + LIFF ฟอร์มลางาน ✅ (นำด้วยสกิล impeccable)
**Migration 0009** `public.gen_request_no(tenant, prefix)` — wrapper ของ `app.next_doc_number` ออกเลขคำขอ `LEV-DDMMYYYY-0001` (Bangkok tz, security definer, grant ครบ) → push cloud + verify RPC คืน `LEV-12062026-0001`

**LIFF ฟอร์มลางาน** (`src/app/liff/`)
- `layout.tsx` + `theme-lock.tsx` — surface เดี่ยวใต้ root layout, ล็อกธีม light, viewport มือถือ
- `leave/page.tsx` (server) — อ่าน `?acct=` → ดึง line_account (liff_id) + leave_types ของ tenant ด้วย admin
- `leave/leave-form-client.tsx` — โหลด LIFF SDK (CDN) → init → getProfile → resolve employee; ฟอร์ม: เลือกประเภทลา (chip color-coded + ยอดคงเหลือ), ช่วงวันที่ (native date), toggle ลาครึ่งวัน (เช้า/บ่าย), เหตุผล, summary นับ**วันทำงาน**สด + เตือนเกินสิทธิ์, ปุ่ม sticky; states ครบ loading(skeleton)/needlink/error/success(ใบเสร็จ)
- `leave/actions.ts` — `resolveEmployee` (employee + balances ปีปัจจุบัน), `submitLeaveRequest` (Zod, นับวันทำงานหักเสาร์-อาทิตย์+วันหยุด tenant, gen_request_no, insert source=liff, push ยืนยันกลับแชต best-effort)
- `liff.css` — ใช้ token เดิม; **แก้บั๊ก overflow:** native `input[type=date]` ใน Chromium มี intrinsic min-width ~165px ไม่หด → จอ <460px ให้ date stack แนวตั้ง (`@media min-width:460` ถึงวางคู่)
- **verify:** tsc สะอาด + screenshot ผ่าน headless Chrome (ฟอร์มเรนเดอร์ครบสวย). หมายเหตุ: headless มี viewport floor ~460px ถ่ายจอแคบกว่านั้นไม่ได้ — ยืนยัน layout มือถือด้วยการ force-stack ชั่วคราว

**Rich Menu** (`scripts/richmenu.html` → `richmenu.png` → `setup-rich-menu.mjs`)
- ออกแบบ 6 ปุ่ม 2500×1686 (ลางาน/ขอ OT/ลงเวลา/ขอเอกสาร/สถานะคำขอ/ติดต่อ HR) tile สี soft ตามแบรนด์ + ไอคอน inline SVG เรนเดอร์เป็น PNG ด้วย headless Chrome
- สคริปต์: ลบเมนูเก่า → สร้าง definition (6 tap zones) → อัปโหลดรูป (api-data host) → ตั้ง default ทุกผู้ใช้ → **deployed: `richmenu-41671d7359f67ce5721c151507c87e84`**
- ปุ่ม “ลางาน” = uri เปิด LIFF ถ้ามี `LINE_LIFF_ID`, ไม่งั้น postback (webhook ตอบ buttons-template ลิงก์ฟอร์ม)

**Webhook ต่อยอด** (`/api/line/webhook/[id]`)
- รองรับ event `postback` → map action 6 ปุ่ม; “สถานะคำขอ” query leave_requests จริง 5 รายการล่าสุด; OT/ลงเวลา/เอกสาร = “เร็วๆ นี้”; ติดต่อ HR = ข้อมูลติดต่อ
- สร้าง `baseUrl` จาก `x-forwarded-host` → deep-link ฟอร์ม LIFF ได้แม้ tunnel เปลี่ยน
- keyword shortcut: พิมพ์ “ลา/สถานะ” ก็ทำงานได้แม้ไม่มี rich menu; follow/greeting ชี้เมนูล่าง

**🔴 ค้าง (Pong) — สร้าง LIFF (กติกาใหม่ของ LINE):** ⚠️ **เพิ่ม LIFF ใน Messaging API channel ไม่ได้แล้ว** ต้องทำบน **LINE Login channel**
1. สร้าง **LINE Login channel** ใน **provider เดียวกับ hrline** (สำคัญมาก: userId เป็น per-provider — provider เดียวกันเท่านั้น userId ถึงตรงกับที่บอทเก็บ ฟอร์มถึง resolve พนักงานเจอ) · App type = Web app
2. ใน Login channel → tab LIFF → Add · Endpoint = `<host>/liff/leave?acct=d3684f40-f566-4604-b5bf-262dc4f443cd` · Size = Full · Scope = profile
3. คัด LIFF ID ใส่ `.env.local` `LINE_LIFF_ID=...`
4. รัน `node scripts/register-line.mjs` + `node scripts/setup-rich-menu.mjs` → ปุ่มลางานเปิดฟอร์มตรง
- โค้ดไม่ต้องแก้ (ฟอร์มใช้ liff.init/getProfile อยู่แล้ว ใช้กับ LIFF บน Login channel ได้ทันที). ก่อนตั้ง LIFF ปุ่มลางานเปิดฟอร์มได้แต่ขึ้น “ยังไม่ได้ตั้งค่า LIFF” เพราะดึง userId ไม่ได้นอก LIFF context

### 2026-06-11 — Phase 2 เริ่ม: LINE webhook infrastructure ✅ (รอ credentials)
- **`lib/crypto.ts`** — AES-256-GCM เข้ารหัส LINE secret/token at rest (key = APP_ENCRYPTION_KEY ใน .env.local, generate แล้ว)
- **`lib/line/verify.ts`** — ตรวจ X-Line-Signature (HMAC-SHA256, timingSafeEqual)
- **`lib/line/client.ts`** — replyMessage / pushMessage (Messaging API)
- **`/api/line/webhook/[id]`** (multi-tenant): หา line_account จาก path id → ตรวจลายเซ็นด้วย channel secret ของ tenant นั้น → dedup ด้วย webhookEventId (line_webhook_events) → ตอบ 200 เสมอ → handle: follow (greeting), text message (ถ้าพบ employee = เมนู, ถ้าไม่พบ = **ผูกบัญชีด้วยรหัสพนักงาน EMP-xxxx** อัตโนมัติ), log line_messages
- **`scripts/register-line.mjs`** — เข้ารหัส + upsert line_account ของ Demo Co + พิมพ์ webhook URL
- tsc ผ่าน; POST webhook ทดสอบคืน 404 (หา channel ไม่เจอ = route ทำงาน)

**สถานะ LINE (2026-06-12):** Bot **hrline** `@769uikdv` · channel ลงทะเบียนแล้ว `line_account id = d3684f40-f566-4604-b5bf-262dc4f443cd` · token verified · encrypt/decrypt ผ่าน
**cloudflared** ดาวน์โหลดไว้ที่ `.tools/cloudflared.exe` (gitignored); tunnel ปัจจุบัน: `https://inbox-earning-military-excel.trycloudflare.com` (ephemeral — เปลี่ยนทุกครั้งที่รันใหม่)
**Webhook URL:** `https://inbox-earning-military-excel.trycloudflare.com/api/line/webhook/d3684f40-f566-4604-b5bf-262dc4f443cd`
**✅ เชื่อมสำเร็จ (2026-06-12):** ตั้ง Webhook URL + Use webhook ON + Response mode = Bot → ทักบอท → ผูกบัญชี EMP-2026-0002 (วราภรณ์) สำเร็จ, webhook POST 200, line_messages logged
**สาเหตุที่เงียบก่อนหน้า:** ยังไม่ได้ตั้ง Webhook URL ใน LINE console (config ไม่ใช่บั๊กโค้ด) — ดีบักจาก dev log พบว่าไม่มี request เข้าเลย
**ยังไม่ทำ:** Rich Menu, LIFF forms, leave/OT/attendance flows, AI intent (Phase 4)
**หมายเหตุ:** tunnel URL trycloudflare เป็น ephemeral — ถ้ารันใหม่ต้องตั้ง Webhook URL ใหม่; production ควร deploy Vercel
- **หน้าใหม่:** `/dashboard/departments` + `/dashboard/positions` — CRUD เต็ม (เพิ่ม/แก้ไข/ลบ soft delete) + คอลัมน์ **จำนวนพนักงาน** ต่อแผนก/ตำแหน่ง
- **DRY:** `components/name-code-crud.tsx` (generic client) + `lib/crud/name-code.ts` (server helper create/update/remove, validate Zod, scope tenant, จับ unique-code 23505) + `lib/crud/types.ts`; actions ต่อ entity ส่งเป็น props
- **`components/ui/confirm-dialog.tsx`** — modal ยืนยันสวยๆ แทน `window.confirm` (ใช้ทั้งลบพนักงาน/แผนก/ตำแหน่ง)
- sidebar "บุคคล" ชี้ แผนก/ตำแหน่ง เป็นหน้าจริง (เลิก "เร็วๆ นี้") + catFromPath/TITLES อัปเดต
- tsc + compile ผ่าน (แก้ TS union-narrowing ของ guard → ใช้ type predicate)

### 2026-06-11 — แก้ไข/ลบพนักงาน ✅
- server actions เพิ่ม: `getEmployee(id)` (ดึงรายละเอียด scope tenant), `updateEmployee(id,input)` (validate Zod, scope tenant), `deleteEmployees(ids)` (**soft delete** set deleted_at, scope tenant)
- DataTable: onAction ส่ง `clear()` เพื่อล้าง selection หลังลบ
- employees-client: toolbar **แก้ไข** (ทีละ 1 → modal prefilled ใช้ EmployeeModal ร่วมกัน mode create/edit) + **ลบ** (confirm → soft delete หลายคน → refresh)
- ทุก mutation scope ด้วย `tenant_id` (กันแก้ข้าม tenant) + set updated_by
- tsc + compile ผ่าน

### 2026-06-11 — ฟอร์มเพิ่มพนักงาน (บันทึกจริง) ✅
- **migration 0008**: `public.gen_employee_code(tenant)` ออกรหัส EMP-YYYY-0001 (invoker, service_role bypass RLS)
- **app-layer data access** (ไม่ต้องพึ่ง JWT hook): `lib/supabase/admin.ts` (service client, server-only) + `lib/auth-context.ts` `getContext()` (session.getUser → admin อ่าน users row → tenantId/role)
- **server action** `actions.ts createEmployee()` — validate ด้วย **Zod** → gen code → insert (service role + scope tenant) → revalidate
- **employees page**: server ดึง employees/departments/positions scope tenant ด้วย admin → **ตารางโชว์ 6 คนแล้วโดยไม่ต้องเปิด hook**
- **employees-client.tsx**: ปุ่ม + เพิ่มพนักงาน → **modal ฟอร์ม** (ชื่อ/นามสกุล/ชื่อเล่น/อีเมล/เบอร์/แผนก/ตำแหน่ง/ประเภทจ้าง/วันเริ่มงาน) + select แผนก/ตำแหน่งจริง; รองรับ `?new=1` เปิด modal จาก command palette
- CSS: modal/form-grid/select; ลบ employees-table.tsx เก่า
- **แก้บั๊ก**: counter ออกรหัสยังเป็น 0 (seed ใส่รหัส fix) → จะชน 0001 → เพิ่ม `scripts/sync-counter.mjs` sync counter = 6 → next = EMP-2026-0007
- `npx tsc --noEmit` ผ่านสะอาด


### 2026-06-11 — Login page สไตล์ Atlas ✅
- `login/page.tsx` ใหม่: การ์ด login-card + โลโก้ + ช่อง email/password มีไอคอนในช่อง + ปุ่มโชว์/ซ่อนรหัส + "จดจำฉันไว้" (.cb) + ปุ่มสลับธีมมุมขวาบน + ปุ่มเข้าสู่ระบบ + ลิงก์สมัคร — คงแบรนด์ LINE HR AI, ยังใช้ Supabase auth จริง
- เพิ่ม CSS .login-card/.login-logo/.in-icon + icons (mail/lock/eye-off/arrow-right)
- dev recompile /login = 200 OK

### 2026-06-11 — Redesign UI เป็นสไตล์ "Atlas Workspace" ✅ (build ผ่าน)
**ตามรีเฟอเรนซ์** `C:\Users\Admin\Documents\HTML\index.html` ที่ Pong ให้มา — port design system เข้าโปรเจกต์:
- **globals.css** เขียนใหม่: token 3 ธีม (light/dark/dark2 ค่าตาม Atlas) + **density 4 ระดับ** (sm/compact/md/lg) ขับด้วย CSS var + component classes (rail/sidebar/navbar/stat/tbl/cb/floatbar/seg/pop/tooltip/mobnav) + bridge @theme ให้ Tailwind utility เดิมยังใช้ได้
- **lib/theme.ts + theme-provider**: เพิ่ม density + no-flash script set ทั้ง data-theme/data-density
- **app-shell ใหม่**: nav 2 ชั้น (icon rail หมวด + secondary sidebar) + navbar (search/สร้าง/bell/profile) + **profile dropdown มี theme+density seg** + online pulse + mobile bottom nav + drawer
- **DataTable**: checkbox `.cb`, กดทั้งแถว, **floating pill toolbar** (ส่งออก/ปิดการใช้งาน/ปิด)
- **stat cards สีมีมิติ (3D)**, StatusBadge → chip, Button → .btn, Card → .card
- icons.tsx เพิ่ม ~16 ตัว (inline SVG)
- ลบ theme-switcher.tsx (ย้ายไป profile dropdown)
- เจอ dev 500 "Cannot find module ./173.js" = stale `.next` จากการรัน build ทับขณะ dev รัน → ล้าง .next + restart หาย (ไม่ใช่บั๊กโค้ด; build prod ผ่านตลอด)

**ค้าง:** ยังไม่ screenshot verify ทุกธีม/density; hook ยังต้องเปิด (employees ถึงจะโชว์ 6 คน)


### 2026-06-11 — Phase 1: Auth + Employees ต่อ DB จริง ✅ (รอ hook toggle)
**ทำอะไร:**
- **migration 0006** — `app.custom_access_token_hook` (ฉีด tenant_id/user_role/is_super_admin/platform_role เข้า JWT) + permissive policy ให้ supabase_auth_admin อ่าน users/platform_users + `public.seed_tenant_defaults` wrapper (rpc)
- **migration 0007** — grant `usage` schema app + execute helper fns ให้ anon/authenticated/service_role (แก้บั๊ก "permission denied for schema app" ตอน audit trigger ยิงตอน insert employees)
- enable hook ใน `config.toml` (local)
- **UI/auth:** `/login` (email+password), `dashboard/layout` ป้องกัน session (redirect /login), logout ใน sidebar, employees แยกเป็น **server page (fetch จริงจาก Supabase, RLS-scoped)** + `employees-table` (client)
- **scripts:** `seed-demo.mjs` (Demo Co: defaults + 4 แผนก/ตำแหน่ง + admin user + 6 พนักงาน, idempotent), `verify-login.mjs`
- `npm run build` ผ่าน 7 routes

**Verified:** login สำเร็จ; แต่ JWT ยัง**ไม่มี tenant_id** เพราะ hook ยังไม่เปิดบน cloud → employees RLS คืน 0
**🔴 ค้าง (Pong กดเอง):** Supabase dashboard → Authentication → Hooks → **Custom Access Token** → enable → เลือกฟังก์ชัน `app.custom_access_token_hook` → จากนั้น `node scripts/verify-login.mjs` ต้องเห็น tenant_id + 6 พนักงาน

---

### 2026-06-11 — Phase 1: Design system + Dashboard shell ✅ (build ผ่าน)
**ทำอะไร (นำด้วยสกิล impeccable):**
- `PRODUCT.md` + `DESIGN.md` — register=product, บุคลิก "น่าเชื่อถือ+มืออาชีพ", anti-refs: AI-generic/การ์ตูน/ราชการเก่า/รกแน่น
- **Design tokens** (`globals.css`): semantic token set เต็ม + **3 ธีม Light/Dark/Dark-2** สลับ real-time ผ่าน `data-theme` + no-flash script (`lib/theme.ts`)
- **Components:** `theme-provider` + `theme-switcher`, `icons.tsx` (inline SVG ไม่ใช้ library), `ui/{button,card,status-badge}`, `app-shell` (floating sidebar/topbar + mobile drawer), `data-table` (กดทั้งแถว → **Bottom Action Toolbar slide-up**, ไม่มีปุ่ม edit/delete ในแถว)
- **หน้า:** `/dashboard` (overview: stat + คำขอล่าสุด + ลาวันนี้), `/dashboard/employees` (DataTable demo เต็ม), `/` redirect → /dashboard
- StatusBadge ครบ 7 สถานะ (สี + label เสมอ = color-blind safe)
- `npm run build` ผ่าน 6 routes ✅ | preview: `npm run dev` → http://localhost:3000

**ยังไม่ทำ:** ยังเป็น static demo data — ยังไม่ต่อ Supabase จริง / ยังไม่มี auth / ยังไม่ screenshot verify

---

### 2026-06-11 — Verify secret key + RLS live ✅
- `SUPABASE_SECRET_KEY` = `sb_secret_...` (service role) ใส่ถูกแล้ว
- `scripts/check-secret.mjs` พิสูจน์ live: service key สร้าง/เห็น tenant ได้ (bypass RLS), **anon ถูกบล็อก insert (42501) + เห็น 0 tenant** → tenant isolation ทำงานจริง
- มี tenant ตัวอย่าง **Demo Co** id `0162b805-d262-49ab-a4be-6c56f0921ffb` ไว้ dev
- ค้าง: seed defaults ให้ demo tenant — `app.seed_tenant_defaults` อยู่ schema `app` (ไม่ expose ผ่าน PostgREST) → ต้องทำ wrapper `public` หรือเรียกผ่าน server-side ตอนทำ signup flow

---

### 2026-06-11 — Push DB ขึ้น cloud + แก้บั๊ก RLS ✅ (verified)
**ทำอะไร:**
- พบ region จริง: **Singapore แต่ pooler cluster `aws-1`** (ไม่ใช่ aws-0) — direct host ไม่ resolve (IPv6)
- อัปเดต key เป็นแบบใหม่ `sb_publishable_...` (แทน anon JWT) → แก้ env.ts/client/server/middleware/.env เป็น `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `npx supabase db push` → **bug**: 0003 ล้ม `policy users_ins already exists`
  - **root cause:** DO-loop สร้าง policy ให้ทุกตารางที่มี tenant_id (รวม users, roles) แล้ว special-case section สร้างซ้ำ
  - **fix:** กัน `users` + `roles` ออกจาก loop (`and c.relname <> all(array['users','roles'])`) + ให้ roles section enable RLS + สร้าง CRUD policy ครบเอง
  - **ไม่ปลด RLS** — RLS ยังเปิด force ทุกตาราง (ดู docs/POSTMORTEM-0001.md)
- re-push → 0003/0004/0005 ผ่านครบ
- **verify end-to-end:** REST API query `plans` ด้วย publishable key คืน 4 แผน = migration+seed+RLS+API ทำงานจริง ✅

**สถานะ:** DB live บน Supabase cloud, verified ✅

**ค้างไว้ (รอ Pong):**
- [ ] เปลี่ยน DB password (เคยผ่านแชต) + ใส่ `SUPABASE_SECRET_KEY` ใน `.env.local`
- [ ] (optional) เทส `select app.seed_tenant_defaults('<tenant-uuid>')` กับบริษัทตัวอย่าง

---

### 2026-06-11 — Seed data + Scaffold Next.js ✅ (build ผ่าน)
**ทำอะไร:**
1. **Seed** `supabase/migrations/0005_seed.sql` — permission catalog, system roles (company_admin/hr/manager/employee) + role_permissions, plans (free/starter/pro/enterprise), และ `app.seed_tenant_defaults(tenant)` ที่สร้าง default ครบ (leave types+policies, OT policy+rates, attendance policy, document types, approval workflows 3 module, modules, วันหยุดไทย 2026, trial subscription) — รันครั้งเดียวตอนบริษัทสมัคร
2. **Scaffold Next.js 15 + React 19 + Tailwind v4 + TS:**
   - configs: package.json (deps), tsconfig, next.config.ts, postcss, .gitignore
   - `src/lib/supabase/{client,server}.ts` (@supabase/ssr, anon key + RLS — ไม่ใช้ service_role), `src/middleware.ts` (refresh session), `src/lib/env.ts` (zod validate), `src/lib/utils.ts` (cn)
   - `src/app/{layout,page}.tsx` + `globals.css` (ฟอนต์ Prompt + พาเลตสีจากสเปค + 3 theme tokens ขั้นต่ำ)
   - `.env.example`, `.env.local` (URL + DB pwd; anon/service key รอ Pong)
   - แก้ TS type (`CookieToSet`) → **`npm run build` ผ่านสะอาด** (4 หน้า + middleware)

**สถานะ:** scaffold + seed เสร็จ build-verified ✅

**ค้างไว้ (รอ Pong) — เพื่อ push DB + รัน dev:**
- [ ] **Session Pooler connection string** จาก Supabase (direct host `db.<ref>.supabase.co` ไม่ resolve / SG pooler บอก tenant not found → โปรเจกต์อยู่คนละ region) ดูที่ปุ่ม **Connect → Session pooler** บน dashboard
- [ ] **anon key** + service_role key (Settings → API) ใส่ใน `.env.local`
- [ ] เปลี่ยน DB password หลังใช้เสร็จ (เคยผ่านแชต)

**⚠️ การออกแบบ UI/ดีไซน์จริง (dashboard/LIFF/theme system) จะเรียกสกิล impeccable นำก่อนเสมอ**

---

### 2026-06-11 — ติดตั้ง Supabase CLI + init ✅
**ทำอะไร:** ติดตั้ง toolchain เพื่อเตรียม push migration
- `package.json` + ติดตั้ง `supabase` CLI เป็น devDependency (v2.105.0) ผ่าน npm
- `npx supabase init` → สร้าง `supabase/config.toml` (migrations ทั้ง 4 ไฟล์ยังอยู่ครบ)
- เพิ่ม `.gitignore`
- Node v24.16 (>= 20 ✅), git มี, **Docker ยังไม่มี** → ใช้ cloud push แทน local stack

**ค้างไว้ (รอ Pong):** สร้าง Supabase cloud project แล้วส่ง Project ref + DB password/connection string มา
→ จากนั้น: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push`

---

### 2026-06-11 — Platform layer + Holidays ✅
**ทำอะไร:** เติม Platform/SaaS-management layer ปิด 5 gap ที่ตรวจเจอตอนรีวิว multi-tenant requirement
**ไฟล์:** `supabase/migrations/0004_platform.sql`
**เพิ่ม 6 ตาราง + helpers:**
- `platform_users` + enum `platform_role` (owner/admin/support) แยกจาก tenant role
- `plans`, `subscriptions` (+ enum `subscription_status`, unique 1 live ต่อ tenant)
- `tenant_modules` (เปิด/ปิด leave/ot/attendance/document/ai รายบริษัท)
- `usage_counters` + `app.bump_usage()` (AI messages/storage/เดือน — สำหรับ Platform Dashboard)
- `holidays` + `app.is_working_day(tenant, date)` (validation วันลา/OT)
- ปรับ `app.is_super_admin()` = platform owner/admin; เพิ่ม `app.is_platform()`, `app.platform_role()`
- RLS ครบทุกตารางใหม่ (platform เห็นข้าม tenant แบบ read; support read-only)

**สถานะ:** เสร็จ — ยังไม่ได้รัน migration จริง (ยังไม่ verify)

---

### 2026-06-11 — Phase 0: Foundation DB ✅
**ทำอะไร:** ออกแบบ + เขียน DB schema และ ERD ทั้งหมด (33 ตาราง multi-tenant)
**ไฟล์:**
- `docs/ERD.md` — ERD (mermaid) + หลักการออกแบบ
- `supabase/migrations/0001_foundation.sql` — extensions, `app.*` helpers, enums, running-number, core tables, audit
- `supabase/migrations/0002_modules.sql` — LINE/AI/Leave/OT/Attendance/Documents/Workflow/Notifications/Settings
- `supabase/migrations/0003_rls.sql` — RLS + role `tenant_runtime`
- `README.md`

**การตัดสินใจสำคัญ:**
- LINE = **OA ต่อบริษัท** → unique `(tenant_id, line_user_id)`
- Tenant isolation 3 ชั้น (RLS + app guard + `tenant_runtime` role ไม่มี BYPASSRLS)
- Running number atomic ด้วย `app.next_doc_number()`
- เลื่อน Payroll / Billing / PDPA ไป Phase 5 (มีหมายเหตุในโค้ด)

**สถานะ:** เสร็จ — ยังไม่ได้รัน migration จริงบน Supabase (ยังไม่ verify)

**ต้องทำต่อ (ค้างไว้):**
- [ ] ตั้ง Supabase Auth Hook ฉีด `tenant_id`/`is_super_admin`/`role` เข้า JWT claims
- [ ] เข้ารหัส `channel_secret`/`channel_access_token` ใน `line_accounts` ที่ app layer
- [ ] (optional) รัน migration จริงเพื่อ verify ว่าไม่มี error
- [ ] เลือก Phase ถัดไปกับ Pong
