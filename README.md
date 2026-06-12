# LINE HR AI Agent Platform

Multi-tenant SaaS HR assistant. พนักงานใช้งานผ่าน **LINE** (OA ต่อบริษัท), หัวหน้าอนุมัติผ่าน LINE,
HR/Admin ใช้ **Web Dashboard**. AI Agent 4 ตัว: Leave · OT · Attendance · Document.

## Stack
Next.js (App Router) · TypeScript · Tailwind + Shadcn · Supabase (Postgres/Auth/Storage) ·
LINE Messaging API + LIFF · OpenAI · Vercel.

## Phase 0 — Database (อยู่ในนี้แล้ว)
```
supabase/migrations/
  0001_foundation.sql   extensions, app.* helpers, enums, running-number, core tables, audit
  0002_modules.sql      LINE, AI, Leave, OT, Attendance, Documents, Workflow, Notifications, Settings
  0003_rls.sql          RLS policies + tenant_runtime role
docs/ERD.md             ERD (mermaid) + design decisions
```

### Apply migrations
```powershell
# ผ่าน Supabase CLI (แนะนำ)
supabase db reset            # local
supabase db push             # remote (linked project)

# หรือรันไฟล์ตามลำดับด้วย psql
psql "$env:DATABASE_URL" -f supabase/migrations/0001_foundation.sql
psql "$env:DATABASE_URL" -f supabase/migrations/0002_modules.sql
psql "$env:DATABASE_URL" -f supabase/migrations/0003_rls.sql
```

## Tenant isolation — 3 ชั้น (สำคัญ)
1. **RLS** บนทุกตารางที่มี `tenant_id` (`0003_rls.sql`)
2. **App guard**: ทุก query แนบ `tenant_id`
3. **Runtime role**: webhook/cron ใช้ role `tenant_runtime` (ไม่มี BYPASSRLS) +
   `SET LOCAL app.tenant_id = '<uuid>'` ต่อ transaction
   → **ห้าม** ใช้ Supabase `service_role` กับ request ของผู้ใช้ (มัน bypass RLS)

Dashboard ต้องมี **Supabase Auth Hook** ฉีด `tenant_id`, `is_super_admin`, `role` เข้า JWT claims
เพื่อให้ `app.current_tenant_id()` ทำงาน

## Running numbers
ใช้ `app.next_doc_number(tenant_id, prefix, period_key, pad)` — atomic, กัน race
- Employee `EMP-2026-0001` (period = ปี)
- Leave/OT/Att/Doc `LEV-11062026-0001` (period = DDMMYYYY)

## ยังไม่ทำในเฟสนี้ (จงใจ)
- **Payroll/Salary** → ปลดล็อก Document AI (สลิป/หนังสือรับรองเงินเดือน) — Phase 5
- **Billing/Subscription** ของตัว SaaS — Phase 5
- **PDPA**: consents, data retention, สิทธิ์ลบ — ก่อนขายจริง

## Roadmap (ลำดับ build)
0. ✅ Foundation DB + RLS  ← **ตอนนี้**
1. Employee Core + Web Dashboard (CRUD) — ขายได้ในฐานะ HR system
2. LINE + LIFF แบบ structured (Rich Menu → form) ยังไม่มี AI
3. Approval Workflow engine (configurable) + Notification
4. AI layer (async webhook → intent → slot-filling → confirm)
5. Payroll + Billing + PDPA
