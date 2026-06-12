# Post-mortem 0001 — RLS migration push failure (duplicate policy)

## Summary
`npx supabase db push` ล้มเหลวระหว่าง apply `0003_rls.sql` ด้วย `ERROR: policy "users_ins" for table "users" already exists (SQLSTATE 42710)`. สาเหตุคือ DO-loop ที่สร้าง RLS policy แบบ generic ให้ทุกตารางที่มีคอลัมน์ `tenant_id` ครอบ `users` (และ `roles`) ไปด้วย แล้ว special-case section ด้านล่างในไฟล์เดียวกันสร้าง policy ชื่อเดียวกันซ้ำ → ชนกัน แก้โดยกัน `users` + `roles` ออกจาก loop ให้ special-case section เป็นเจ้าของ policy เพียงจุดเดียว (และให้ `roles` enable RLS + สร้าง CRUD policy เองครบ). Owner: Pong. Migration: `supabase/migrations/0003_rls.sql`.

## Symptom
```
Applying migration 0001_foundation.sql...   (NOTICE: extension "pgcrypto" already exists, skipping)
Applying migration 0002_modules.sql...
Applying migration 0003_rls.sql...
ERROR: policy "users_ins" for table "users" already exists (SQLSTATE 42710)
At statement: 14
  create policy users_ins on users for insert
    with check ( app.is_super_admin() or tenant_id = app.current_tenant_id() )
```
0001 และ 0002 apply สำเร็จ; 0003 ล้มและ rollback (รันใน transaction) ทำซ้ำได้ 100%.

## Root cause
`0003_rls.sql` มี 2 กลไกสร้าง policy ที่ทับกัน:

1. **Generic DO-loop** วนทุกตารางใน `public` ที่มีคอลัมน์ `tenant_id` แล้ว `execute format(...)` สร้าง 4 policy ต่อตาราง: `%I` (select, ชื่อ = ชื่อตาราง), `%s_ins`, `%s_upd`, `%s_del`. ตาราง `users` มี `tenant_id` (nullable, สำหรับ super admin) จึงถูกครอบ → สร้าง `users_ins/upd/del`. ตาราง `roles` ก็มี `tenant_id` (nullable) เช่นกัน.

2. **Special-case section** ด้านล่างสร้าง policy ของ `users` เองอีกชุด (`users_select/ins/upd/del`) เพราะ users ต้องมี logic เพิ่ม (`id = app.current_user_id()` ให้ผู้ใช้เห็น/แก้ข้อมูลตัวเอง).

ชื่อ `users_ins/upd/del` ตรงกันทั้งสองที่ → PostgreSQL โยน 42710 ที่ตัวแรกคือ `users_ins`.

## Why it produced the symptom
loop รันก่อน special-case section ในไฟล์เดียวกัน → ตอนถึง `create policy users_ins` ใน special section, policy ชื่อนี้ถูกสร้างจาก loop ไปแล้ว. error หยุดที่ `users` ก่อนถึง `roles` แต่ `roles` รอดเพราะบังเอิญมี `drop policy if exists roles` (จัดการเฉพาะ select policy ชื่อ `roles` ของ loop) ส่วน `roles_ins/upd/del` ของ loop ไม่ถูกสร้างซ้ำใน 0003 เดิม จึงไม่ error — แต่ทิ้ง policy ค้างไว้ไม่สะอาด.

## Fix
`0003_rls.sql`:
- เพิ่มเงื่อนไขกัน `users` + `roles` ออกจาก generic loop:
  ```sql
  and c.relname <> all (array['users','roles'])
  ```
- `roles` special-case section: เพิ่ม `enable row level security` + `force` (เพราะ loop ไม่ครอบแล้ว) และสร้าง `roles_select/ins/upd/del` ครบ; ลบ `drop policy if exists roles` ที่ไม่จำเป็นแล้ว.

แก้ที่ root cause (ขจัดการสร้างซ้ำ) ไม่ใช่ปิด RLS. RLS ยัง `enable + force` ทุกตารางตามเดิม — tenant isolation ไม่ถูกลด.

## How it was found
- repro: `npx supabase db push` deterministic.
- source trace: grep `create policy|drop policy|relname` ใน 0003 → เห็น loop (บรรทัด 50-70) สร้าง `%s_ins/upd/del` และ special section (บรรทัด 93-99) สร้าง `users_ins/upd/del` ชื่อชนกัน.
- hypotheses:
  - H1 `users` ชน (loop + special) — **ยืนยัน**, ตรง error.
  - H2 `roles` ชนด้วย — **ตัดออก**: loop select policy ชื่อ `roles` ถูก `drop` ก่อน, ins/upd/del ไม่ถูกสร้างซ้ำ.
  - H3 tenants/permissions/system_settings/role_permissions ชน — **ตัดออก**: ไม่มีคอลัมน์ `tenant_id` → loop ข้าม.

## Why it slipped through
ไม่เคยรัน migration จริงก่อนหน้านี้ (ไม่มี Docker local + ยังไม่มี Supabase project) — bug แบบนี้จับได้เฉพาะตอน apply กับ Postgres จริง การ review ด้วยตาเห็น loop กับ special section แยกกันคนละส่วนของไฟล์ จึงมองไม่เห็นว่าชื่อ policy ทับกัน.

## Validation
- re-push หลังแก้: `0003 → 0004 → 0005` apply ผ่านครบ, `Finished supabase db push.`
- end-to-end ผ่าน REST API (publishable key) query `plans` คืน 4 แถว (free/starter/pro/enterprise) = migration + seed (0005) + RLS read policy + PostgREST ทำงานจริง.
- ทดสอบบน Supabase cloud project เดียว (Singapore, aws-1 pooler). ยังไม่ได้ทดสอบ apply ซ้ำบน DB เปล่าใหม่ (idempotency ของทั้งชุดตั้งแต่ศูนย์).

## Action items
- [ ] เพิ่มขั้น verify `supabase db reset` บน DB เปล่า (local เมื่อมี Docker หรือ shadow DB) ก่อน push เพื่อจับ class นี้แต่เนิ่นๆ — Owner: Pong
- [ ] ตรวจ pattern เดียวกันในอนาคต: ถ้าเพิ่ม special-case policy ให้ตารางที่มี `tenant_id` ต้องเพิ่มชื่อตารางใน exclusion array ของ loop — Owner: Pong
- [ ] (เฝ้าระวัง, แยกประเด็น) `line_webhook_events.tenant_id` เป็น null ตอนรับ event แรก แต่ generic insert policy เช็ก `tenant_id = current` → webhook runtime ต้อง `SET app.tenant_id` หลัง resolve ก่อน insert ไม่งั้นถูกบล็อก — ทบทวนตอนทำ Phase 4
