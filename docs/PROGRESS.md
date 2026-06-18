# PROGRESS — LINE HR AI Agent Platform

> สมุดบันทึกความคืบหน้า ลูฟี่อัปเดตไฟล์นี้ทุกครั้งที่ทำงานเสร็จแต่ละก้อน
> รูปแบบ: วันที่ · สิ่งที่ทำ · ไฟล์ที่เกี่ยวข้อง · สถานะ · สิ่งที่ต้องทำต่อ

---

## สถานะรวม (สรุปล่าสุด)
**ระบบใช้งานได้ครบทุก flow บน production แล้ว** — ทั้งทาง LINE (rich menu / keyword / พิมพ์ภาษาธรรมชาติ) และ dashboard

**ฟีเจอร์ที่ live ตอนนี้:**
- **4 flow ครบวงจร:** ลา · OT · เอกสาร (ใช้ approval engine กลาง manager→hr) · ลงเวลา (time-clock) — มี LIFF form + dashboard + อนุมัติผ่าน LINE + ใบเสร็จ Flex
- **AI (Phase 4) — เปิดใช้แล้ว** (`ANTHROPIC_API_KEY` ใส่ใน Vercel แล้ว, model **claude-haiku-4-5**): พิมพ์ภาษาธรรมชาติ → จัด intent + **ดึง slots (วัน/เวลา/ประเภท, แปลง "พรุ่งนี้" เป็นวันที่จริง)** → เปิดฟอร์มที่ใช่/เติมค่าให้
- **กรอกในแชตจบเลย** (ไม่ต้องเปิด LIFF): พิมพ์ "ลา"/"โอที" หรือพูดธรรมชาติ → **quick-reply** (datetimepicker เลือกวัน/เวลา + หมายเหตุ + ส่ง) state ใน `ai_conversations`
- **"AI กำลังตอบ"** loading animation ระหว่าง classify
- เปิดฟอร์มเต็มผ่าน LIFF ได้ทุก flow (ปุ่ม rich menu/ลิงก์ในแชต) — deep-link in-scope ด้วย rewrite `/liff/leave/<form>`

**สำคัญ — ลำดับการ route ข้อความ (text จากพนักงานที่ผูกบัญชีแล้ว):** maybeCollectNote → **AI ก่อน (ถ้ามี key)** → keyword fallback → เมนู

- **Supabase:** Singapore (aws-1 pooler) · migrations ถึง **0009** · Demo Co seeded (6 พนักงาน, admin user) · policy/rates/doc-types/workflow พร้อมจาก `seed_tenant_defaults`
- **Login dashboard:** admin@demo.co / Demo!2026
- **ถัดไป (optional):** prompt caching ลด latency AI · multi-turn AI ถามต่อเมื่อข้อมูลไม่ครบ · generate ไฟล์เอกสารจริง (PDF) · GPS geofence ลงเวลา · Phase 5 (Payroll/Billing/PDPA)
- **อัปเดตล่าสุด:** 2026-06-13

### 🗺️ แผนผังโค้ดสำคัญ
- **Webhook LINE:** `src/app/api/line/webhook/[id]/route.ts` — รับ event, route (note→AI→keyword→menu), postback (อนุมัติ `(ot/doc)approve|reject`, in-chat `cf:*`)
- **Approval engine กลาง:** `src/lib/approval/` (core + leave/ot/document descriptors + index)
- **AI:** `src/lib/ai/intent.ts` (classify+slots, Haiku, structured output) · `src/lib/ai/prefill.ts` (slots→pre param base64url)
- **In-chat form:** `src/lib/line/chatflow.ts` (state ใน ai_conversations, quick-reply, submit reuse actions)
- **LINE client/cards:** `src/lib/line/client.ts` (reply/push/startLoading) · `src/lib/line/flex.ts` (การ์ดทั้งหมด)
- **LIFF forms:** `src/app/liff/{leave,ot,document,checkin}/` (page server + *-client + actions) · `liff.css` · `liff-loading.tsx`
- **Dashboard:** `src/app/dashboard/{leave,ot,documents,attendance,employees,departments,positions}/`
- **Helpers:** `src/lib/ot.ts` · `src/lib/attendance.ts` · `src/lib/crypto.ts` · `src/lib/supabase/admin.ts` · `src/components/app-shell.tsx` (sidebar)
- **Scripts:** `setup-rich-menu.mjs` · `register-line.mjs` · `seed-demo.mjs` · `seed-org.mjs`
- **เทคนิคเทสบน prod (ไม่ push หาคนจริง):** ยิง synthetic webhook event ลายเซ็นถูก + replyToken ปลอม "0"×32 → logic ทำงาน+เขียน DB แต่ reply fail (ไม่มีข้อความหลุด); ตรวจ Flex/quick-reply ด้วย temp route push แล้วเช็ก HTTP 200

### 🌐 Production (โดเมนถาวร — ไม่ต้องเปลี่ยนอีก)
- **GitHub:** `https://github.com/EPICCODING17/line-hr-ai-platform` (private) · workflow: แก้โค้ด → `git push` → Vercel auto-deploy
- **Vercel:** `https://line-hr-ai-platform.vercel.app`
- **Webhook URL (Messaging API channel):** `https://line-hr-ai-platform.vercel.app/api/line/webhook/d3684f40-f566-4604-b5bf-262dc4f443cd` ✅ verified
- **LIFF endpoint (LINE Login channel):** `https://line-hr-ai-platform.vercel.app/liff/leave?acct=d3684f40-f566-4604-b5bf-262dc4f443cd` · LIFF ID `2010383091-kBSUiU9b`
- **Vercel env:** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, APP_ENCRYPTION_KEY, **ANTHROPIC_API_KEY** (เปิด AI แล้ว) · ANTHROPIC_MODEL (ไม่ใส่ = haiku)
- **Rich menu ปัจจุบัน:** 6 ปุ่ม uri/postback (ลา/OT/ลงเวลา/เอกสาร = เปิด LIFF ตรง · สถานะ/ติดต่อ = postback); ถ้าแก้ปุ่มต้องรัน `node scripts/setup-rich-menu.mjs`
- tunnel/cloudflared **เลิกใช้แล้ว** (ใช้แค่ตอน dev local เท่านั้น)

### 2026-06-12 — Deploy GitHub + Vercel ✅
- git init + push ขึ้น GitHub (EPICCODING17) — แก้ปัญหา GCM ค้างบัญชี jakkapong-jpg (403) → ล้าง credential → login EPICCODING17
- Import Vercel + ใส่ env 4 ตัว → build ผ่าน, โดเมนถาวร
- ตั้ง Webhook URL + LIFF endpoint เป็นโดเมน Vercel → **Webhook Verify Success**
- เช็ค production: `/login` 200, `/liff/leave` 200, webhook POST→401(no sig, route alive), GET→405 — ครบ
- บั๊กที่เจอตอน setup: (1) LIFF endpoint ใส่แค่โดเมน → เด้ง /login dashboard → ต้องใส่ path `/liff/leave?acct=` ครบ (2) Webhook ใส่ path ไม่ครบ → 405 → ต้อง `/api/line/webhook/{id}` ครบ

## Roadmap checklist
- [x] **Phase 0** — Foundation DB + RLS
- [x] **Phase 1** — Employee Core + Web Dashboard (CRUD)
- [x] **Phase 2** — LINE + LIFF แบบ structured (Rich Menu → form, ยังไม่มี AI)
- [x] **Phase 3** — Approval Workflow engine (configurable) + Notification — ลา/OT/เอกสาร ใช้ engine กลางตัวเดียว
- [x] **Phase 3.x** — flow ที่เหลือ: ลงเวลา (time-clock) · เอกสาร (approval) ✅
- [x] **Phase 4** — AI layer: intent routing + slot-filling + กรอกในแชต (quick-reply) + loading ✅ *(เหลือ optional: multi-turn ถามต่อ, prompt caching)*
- [ ] **Phase 5** — Payroll + Billing + PDPA

---

## บันทึกรายวัน

### 2026-06-18 — LIFF delight + dashboard/perf polish ✅
- **Mascot asset เฉพาะระบบ**: เพิ่ม `public/brand/hr-mascot.{png,webp}` + `hr-mascot-sm.webp` (10KB) เป็นผู้ช่วย HR โทนขาว/น้ำเงิน/ม่วง/เขียว ตามสีแบรนด์ ใช้เป็น static asset cache ได้
- **LIFF redesign รอบ playful-premium**: เพิ่ม `LiffHero` กลาง (`src/app/liff/liff-hero.tsx`) แล้วใช้กับ 4 flow ลา/OT/เอกสาร/ลงเวลา — hero card + mascot + live pill + flow accent โดยไม่เปลี่ยนสีหลัก
- **LIFF motion/delight**: loading splash ใช้ mascot + badge icon, hero float/sparkle, hover/active feedback บน chips/rows/buttons, clock scan เบา ๆ และยังเคารพ `prefers-reduced-motion`
- **LIFF performance**: รวม LINE SDK loader เป็น `src/app/liff/liff-client.ts` โหลด async/defer + init cache ตาม LIFF ID ลดโค้ดซ้ำใน client forms
- **Dashboard polish/perceived speed**: เพิ่ม `Live HR pulse` overview strip + mascot/progress bars, prefetch route หลักหลัง shell พร้อม, lazy import `CommandPalette`, lazy import Supabase browser client เฉพาะตอน logout, เพิ่ม containment/content-visibility สำหรับ overview sections
- **verify**: `npm.cmd run build` ผ่าน · screenshot LIFF 4 flow ที่ 480px ไม่มี horizontal overflow · dashboard desktop/mobile ไม่มี overflow

### 2026-06-17 — รอบ "สวยขึ้น + เร็วขึ้น" (impeccable · polish + perf)
**เร็วขึ้น (Phase A):**
- **ฟอนต์ Prompt**: ตัดน้ำหนัก `300` ที่ไม่เคยถูกใช้ (grep ทั้ง src ไม่เจอ) → เหลือ 400/500/600/700 · ไฟล์ glyph ไทยหนัก การตัด 1 น้ำหนัก×2 subset ลด blocking font payload (`layout.tsx`)
- **บอตเร็วขึ้น — fast-path คำสั่งเดี่ยว** (`api/line/webhook/[id]/route.ts`): พิมพ์คำสั่งเดี่ยวเป๊ะ ("ลา"/"โอที"/"ลงเวลา"/"เอกสาร"/"สถานะ" + alias) → `bareCommand()` เปิดฟอร์มทันที **ข้าม AI 3–9 วิ**. ประโยคยาว ("พรุ่งนี้ขอลาป่วย") ยังวิ่งเข้า AI เพื่อดึง slot เหมือนเดิม — ได้เร็วโดยไม่เสียความฉลาด + ประหยัด API call. helper `BARE_COMMANDS`/`openFlow` (DRY กับ keyword fallback เดิม)
- **prompt caching — ตั้งใจไม่ใส่**: system prompt ~1.2k token แต่ Haiku ต้อง ≥2048 token ถึง cache ได้ → ใส่แล้วไม่ทำงานบน Haiku (ค่าเริ่ม). fast-path ให้ผลเร็วกว่ามาก. ถ้าสลับไป Sonnet/Opus ค่อยเปิด cache_control
**สวยขึ้น (Phase B — Dashboard overview):**
- **Stat cards → สไตล์ "B นุ่มคุมโทน"** (Pong เลือกจากเทียบ 3 แบบ A เดิม/B/C): การ์ดพื้น `--surface` neutral + ไอคอน tile สีอ่อน (`color-mix 15%`) + ตัวเลขสีหมึก + ลูกศรเทรนด์เฉพาะตัวบวก. เลิกบล็อกสีเต็มใบ (เข้าข่าย hero-metric template / ขัด Restrained). ดิมจาก elevation ตอน hover ไม่ใช่ saturation
- CSS: ลบ `.stat` แบบ saturated เดิมทิ้ง (dead code) เพิ่ม `.stat-soft`(+`.accent` variant สำรอง) · เพิ่มไอคอน `IconTrendUp`
- **verify**: tsc สะอาด · screenshot ผ่าน preview route ชั่วคราว (ไม่ต้อง auth) เรนเดอร์เลย์เอาต์เดียวกับ dashboard จริง → ยืนยัน B สวยในบริบทเต็ม แล้วลบ preview ทิ้ง
- **ค้าง**: Dashboard overview ยังเป็น static demo data (STATS/RECENT/TODAY hardcode) — ยังไม่ wire DB จริง

**สวยขึ้น (Phase B — LIFF forms):**
- **ประเมินทั้งชุด 4 ฟอร์ม** (ลา/OT/ลงเวลา/เอกสาร) ด้วย screenshot จริงบน mobile — ถ่ายผ่าน `?u=<lineUserId>` (devUserId bypass LIFF) ของวราภรณ์ EMP-2026-0002. **สรุป: คราฟต์ระดับสูงอยู่แล้ว** (ผ่าน impeccable delight) — chip/rate tile, summary sticky, clock hero, success confetti, reduced-motion ครบ → **ไม่ churn ของดี**
- **แก้จุดจริง 1 จุด — หน้าลงเวลา vertical balance**: เนื้อหา (นาฬิกา/สถานะ/toggle) สั้น เกาะกลุ่มบน เหลือช่องว่างเหนือปุ่ม sticky → wrap เป็น `.checkin-body{flex:1;justify-content:center}` จัดกึ่งกลางช่องว่าง (มิเรอร์ `.liff-form{flex:1}` ของฟอร์มลา/OT). `liff.css` + `checkin-client.tsx`
- **verify**: tsc สะอาด · screenshot ลงเวลา ก่อน/หลัง ยืนยันสมดุลขึ้น
- **เทคนิคถ่าย LIFF (เก็บไว้ใช้ต่อ)**: `localhost:3000/liff/<form>?acct=<id>&u=<lineUserId>` bypass LIFF ได้ · headless Chrome มี **viewport floor ~460px** → ถ่ายที่ window 480 (= max-width ของ `.liff-shell`) เห็นเต็มไม่โดนตัด; ถ้าตั้งแคบกว่านั้น layout 460 ถูก capture ลง canvas แคบ → ขวาโดนตัด
- **ค้าง/optional**: ถ้าอยากดันต่อ (bolder delight / empty-balance state สวยกว่านี้) ยังทำได้ แต่ปัจจุบันถือว่านิ่งสวย · balance ของ demo เป็น 0 ทุกประเภท (ไม่มี seed) ทำให้ขึ้น "เกินสิทธิ์" — data ไม่ใช่ดีไซน์

### 2026-06-13 — UX แชต: "AI กำลังตอบ" + กรอกฟอร์มในแชต ✅
- **Loading indicator**: `startLoading()` (`line/client.ts`) เรียก `chat/loading/start` ของ LINE → โชว์ "…" ระหว่าง classify (เฉพาะ path AI, 20s) → ผู้ใช้รู้ว่ากำลังตอบ
- **In-chat quick form** (`src/lib/line/chatflow.ts`): เลือกวัน/เวลาด้วย **LINE datetimepicker** + หมายเหตุ + กดส่ง **โดยไม่ต้องเปิด LIFF** — state เก็บใน `ai_conversations` (multi-turn), submit reuse `submitOtRequest`/`submitLeaveRequest`
  - การ์ด `chatOtFlex`/`chatLeaveFlex` (flex.ts): ปุ่ม datetimepicker (date/time) + ✏️หมายเหตุ + ✅ส่ง + ยกเลิก + "เปิดฟอร์มเต็ม" (ลิงก์ LIFF พร้อม pre)
  - postback `cf:date|start|end|note|submit|cancel` → `onChatPostback`; พิมพ์ข้อความตอน awaitingNote → `maybeCollectNote`
  - **พิมพ์** "ลา"/"โอที" หรือ AI จัด intent leave/ot → เปิด in-chat form (เมนู rich menu ยังเปิดฟอร์มเต็มเหมือนเดิม)
- **verify production:** จำลอง postback ครบวงจร (text→conv→เลือกเวลา×2→หมายเหตุ→ยกเลิก) state อัปเดตถูกทุกสเต็ป ✅; submit ใช้ action ที่ verify แล้ว
- **ค้าง:** prompt caching ลด latency loading ภายหลัง

#### แก้บั๊ก: พิมพ์ "ลา/โอที" แล้วการ์ดไม่ขึ้น (นิ่ง)
- **อาการ:** พิมพ์ "ลา" → ไม่มีอะไรขึ้น (LINE reply เงียบ)
- **Root cause:** ปุ่มในการ์ด in-chat ใส่ค่าวัน/เวลา/หมายเหตุไปต่อใน action `label` (เช่น `📅 ตั้งแต่: 2026-06-13`) → **เกิน 20 ตัวอักษร** (เพดาน label ของ LINE) → ทั้งข้อความ Flex ถูก reject (400) → ไม่มีข้อความขึ้น
- **Fix:** `label` ปุ่มสั้นคงที่ ("เลือกวัน"/"เลือกเวลา"/"เพิ่ม") ค่าปัจจุบันย้ายไป text แยกในแต่ละแถว (`fieldRow`/`noteRow`)
- **verify:** temp route push การ์ดจริง (leave+ot) → LINE ตอบ **200 sentMessages** (ยืนยันการ์ดถูกต้อง + เห็นหน้าตาจริงในบัญชีทดสอบ) แล้วลบ route

#### แก้บั๊ก: การ์ด in-chat "ส่งซ้ำ 2-3 รอบ"
- **อาการ:** แตะปุ่มเลือกวัน/เวลาแล้วการ์ดเด้งซ้ำกองในแชต
- **Root cause:** ทุก picker postback `renderCard` ส่ง **การ์ด Flex เต็มใบใหม่** (LINE แก้ข้อความเดิมไม่ได้) → แตะ N ครั้ง = N การ์ด. (ตรวจแล้วไม่ใช่ dedup/retry: `line_messages`/`line_webhook_events` ไม่ซ้ำ, `unique(dedup_key)` มีอยู่)
- **Fix:** เปลี่ยนเป็น **Quick Reply** — ปุ่ม (datetimepicker/postback/uri) ลอยเหนือคีย์บอร์ด ไม่กองในแชต; แต่ละ action ตอบ "ข้อความสรุปสั้น + ปุ่มชุดเดิม" แทนการ์ดเต็ม (`chatflow.ts` ใช้ `qrMsg`); ลบ `chatOtFlex`/`chatLeaveFlex` ทิ้ง
- **verify:** push quick-reply จริง → LINE 200; flow state machine ผ่านอยู่แล้ว

### 2026-06-13 — Phase 4 เริ่ม: AI intent routing ✅ (Claude)
- **`src/lib/ai/intent.ts`** — `classifyIntent(text)` ยิง Claude 1 call (`@anthropic-ai/sdk`, model `claude-opus-4-8` ค่าเริ่ม, override ได้ด้วย `ANTHROPIC_MODEL` เช่น haiku), **structured output** (`output_config.format` json_schema) + `effort: "low"` → `{intent, confidence, reply}`. 7 intent: leave/ot/document/attendance/status/greeting/unknown. **no-op คืน null ถ้าไม่มี `ANTHROPIC_API_KEY`** (บอตยัง routing ด้วย keyword ได้)
- **wire webhook**: ข้อความ free-form ที่ keyword จับไม่ได้ → `classifyIntent` → ตอบ ack (reply ไทยจาก AI) + เปิดฟอร์มตาม intent (leave/ot/document/attendance/status) หรือข้อความช่วยเหลือ (greeting/unknown). log ลง `ai_intent_logs` (intent/confidence/model/tokens/latency, best-effort)
- **`.env.example`** เพิ่ม `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` (แทน OPENAI เดิม)
- **verify:** tsc + `next build` ผ่าน (SDK รับ output_config+effort). **ยังไม่ได้เทส classification จริง** เพราะไม่มี API key ใน env — จะ active เมื่อ Pong ใส่คีย์บน Vercel; fallback (ไม่มีคีย์) ปลอดภัย คงพฤติกรรม keyword เดิม
- **ค้าง:** slot-filling (ดึงวัน/เวลา/ประเภทเติมฟอร์มผ่าน query param) + multi-turn dialog (`ai_conversations` state) + async (`line_webhook_events` processing) ยังไม่ทำ

### 2026-06-13 — Phase 4: AI slot-filling ✅ (เติมฟอร์มอัตโนมัติ)
- **`intent.ts`** ขยาย: เพิ่ม **today (เวลาไทย) ในพรอมป์** เพื่อแปลงวันสัมพัทธ์ ("พรุ่งนี้"→YYYY-MM-DD) + schema มี `slots` (leaveType/start/end/halfDay · otDate/start/end · docType/language · reason) ทุกฟิลด์ nullable+required (เข้ากับ structured output แบบ strict)
- **`src/lib/ai/prefill.ts`** — `buildPrefill(intent, slots)` validate (date/time regex, map category/doc code) → object ต่อฟอร์ม + `encodePrefill`/`decodePrefill` (**base64url** กันไทย/อักขระเพี้ยนตอนผ่าน `liff.state` ของฟอร์ม sub-path)
- **webhook**: AI branch (leave/ot/document) สร้างการ์ดลิงก์ `…?pre=<base64url>` (`prefilledFormCard`)
- **ฟอร์ม leave/ot/document**: page ถอด `pre` (server) → ส่ง `prefill` prop → client seed state เริ่มต้น (ประเภท/วัน/เวลา/เหตุผล) · OT auto-rate คำนวณใหม่ตามวันที่ที่เติม
- **verify:** tsc + build สะอาด · screenshot ฟอร์มลา (ลาป่วย+วันที่+เหตุผลไทย) & OT (22:00→02:00 ข้ามคืน+auto×2+รวม 4 ชม.) เติมครบ · production: ส่ง NL จำลอง "คืนนี้ขออยู่ทำงานต่อถึงตีสอง" → intent ot conf 0.95, log สำเร็จ (schema slots ใหม่ไม่ 400 บน Haiku)
- หมายเหตุ latency คลาสซิฟาย ~3–9 วิ (cold start + พรอมป์ ~1.2k token) — รับได้ (replyToken ใช้ได้ ~30 วิ); ปรับได้ด้วย prompt caching ภายหลัง

### 2026-06-13 — flow เอกสาร + ลงเวลา ครบวงจร ✅ (impeccable)
**เอกสาร (approval — ใช้ engine กลาง):**
- `src/lib/approval/document.ts` — descriptor (document_requests/document_approval_steps, module=document) + `instantiateDocumentApproval`/`actOnDocRequest`
- Flex: `docReceiptFlex`/`docApprovalRequestFlex`(postback `docapprove:`/`docreject:`)/`docApprovalResultFlex`
- LIFF `/liff/document` — เลือกประเภท (5 ชนิด chips) + ภาษา (ไทย/อังกฤษ) + เดือน/ปี (เฉพาะชนิด requires_salary) + วัตถุประสงค์
- Dashboard `/dashboard/documents` — mirror OT (filter + อนุมัติ/ปฏิเสธ)
- **verify:** temp route create→instantiate (HR step เดียว=ปนัดดา)→approve→approved ✅ + screenshot ฟอร์มผ่าน (ref-month โผล่เฉพาะสลิป)

**ลงเวลา (time-clock — ไม่ใช่ approval):**
- `src/lib/attendance.ts` — bangkokNow, formatTimeBkk, timeToMinutes, workedDuration, workModeLabel
- LIFF `/liff/checkin` — `checkin-client.tsx`: clock hero สด + สถานะเข้า/ออก + toggle ออฟฟิศ/บ้าน + ปุ่มเช็คอิน(เขียว)/เช็คเอาท์(ม่วง) + GPS best-effort
- `actions.ts` — `resolveAttendance` (record วันนี้+policy), `checkIn` (upsert, คำนวณสายจาก work_start+grace, gen ATT, push ใบเสร็จ), `checkOut` (update + รวมเวลางาน)
- `attendanceReceiptFlex` (เข้า=น้ำเงิน/ออก=ม่วง)
- Dashboard `/dashboard/attendance` — read-only: filter (ทั้งหมด/วันนี้/มาสาย/ไม่ลงออก) + การ์ดเข้า→ออก+รวมเวลา+badge สาย
- **verify:** temp route checkIn→กันซ้ำ→checkOut→กันซ้ำ ✅ record ATT ครบ + screenshot หน้าลงเวลาผ่าน (clock hero+ปุ่ม)

**Wiring (ทั้งสอง):** webhook ปุ่ม/keyword เปิดฟอร์ม (เอกสาร/ลงเวลา), docapprove/docreject, status รวมเอกสารด้วย · next.config rewrite `/liff/leave/{document,checkin}` → ปลายทาง (เปิดผ่าน `liff.line.me/{id}/{document,checkin}` in-scope) · leave transit splash รองรับ document/checkin · setup-rich-menu ปุ่มลงเวลา+เอกสารเป็น uri · sidebar เปิดเมนูจริง
- **ไม่ต้อง migration:** ตาราง+policy+doc types+workflow seed พร้อมจาก `seed_tenant_defaults`
- **ค้าง:** ต้อง re-run `setup-rich-menu.mjs` หลัง deploy (ปุ่มชี้ path ใหม่) · GPS geofence (work_locations ว่าง) ยังไม่จับคู่ · เอกสารยังไม่ generate ไฟล์จริง (generated_documents) — Phase ถัดไป


### 2026-06-13 — Phase 3.x: OT flow ครบวงจร ✅ (impeccable craft · refactor engine เป็น generic)
- **Refactor approval engine → generic** (`src/lib/approval/`): แตกเป็น `core.ts` (control-flow ขับด้วย **module descriptor**: ตาราง request/step + ฟังก์ชันสร้างการ์ด Flex ฉีดเข้า) + `leave.ts` + `ot.ts` + `index.ts` (re-export). wrapper เดิม `instantiateLeaveApproval`/`actOnLeaveRequest` คงลายเซ็น → call site ลา (webhook/dashboard) ไม่ต้องแก้. เพิ่ม `instantiateOtApproval`/`actOnOtRequest`. ลบ `src/lib/approval.ts` เดิม
- **`src/lib/ot.ts`** (pure, ใช้ทั้ง server+client): rate type/label/multiplier, `otHours` (รองรับข้ามคืน), `autoRateType` (holiday>weekend>weekday), `otTimestamps` (+07:00, ม้วน end เป็นวันถัดไป), `formatOtTimeRange` (Intl Asia/Bangkok), `fmtHours`
- **LIFF ฟอร์ม OT** (`src/app/liff/ot/`): page (server โหลด policy/rates/holidays) + `ot-form-client.tsx` — วันที่ + เวลาเริ่ม/สิ้นสุด (native time, hint ข้ามคืน) + **อัตรา auto-suggest จากวันที่ + เลือกเองได้** (chip 2×2 โชว์ ×N + badge "แนะนำสำหรับวันนี้") + project/customer (เฉพาะถ้านโยบายบังคับ) + เหตุผล + **ยอด OT เดือนนี้ X/36 ชม.** + summary ชั่วโมงสด + เตือนเกินเพดาน/วัน. states ครบ (skeleton/needlink/error/success ใบเสร็จ) — reuse `liff.css` + เพิ่ม `.rate-tile/.rate-suggest/.ot-hint/.ot-month`
- **`liff/ot/actions.ts`**: `resolveOtEmployee` (employee + OT เดือนนี้ pending+approved) · `submitOtRequest` (Zod, คุม max/วัน + requiresProject, gen_request_no `OT-DDMMYYYY-0001`, insert source=liff, push ใบเสร็จ, instantiate)
- **Flex OT** (`flex.ts`): `otReceiptFlex` · `otApprovalRequestFlex` (ปุ่ม postback `otapprove:`/`otreject:`) · `otApprovalResultFlex`; generalize `statusListFlex` (`{title, sub, status, requestNo}`) ให้รวมลา+OT
- **หน้า `/dashboard/ot`** — mirror หน้าลา (filter tabs + การ์ด + อนุมัติ ConfirmDialog/ปฏิเสธ modal) + เปิดเมนู sidebar "OT" (soon→href) + TITLES
- **Wire webhook**: ปุ่ม/keyword "ขอ OT" → เปิดฟอร์ม OT (direct-URL LIFF เดียวกับลา ไม่ต้องตั้ง LINE console เพิ่ม) · postback `otapprove:/otreject:` → actOnOt (ตรวจก่อน regex ลาเพื่อกันชน) · "สถานะคำขอ" รวมลา+OT เรียงตามเวลา
- **ไม่ต้องมี migration**: ตาราง OT + workflow "อนุมัติ OT" (manager→hr) + policy(4ชม./วัน,36/เดือน) + rates(1.5/2/3/3x) seed พร้อมแล้ว
- **verify**: tsc + `next build` สะอาด (route `/dashboard/ot`,`/liff/ot` คอมไพล์) · temp route ยิง engine จริง create→instantiate(resolve เมธี/ปนัดดา)→approve×2(step1→step2→approved)→กันผู้อนุมัติผิดคน→กันกดซ้ำ ครบ · screenshot ฟอร์ม LIFF OT เรนเดอร์จริง (auto-rate เสาร์→×2, ยอดเดือน, summary) · ลบ temp route + คำขอทดสอบ (เหลือ OT-0002 weekend pending ไว้โชว์ dashboard)
- **ค้าง**: ปุ่มอนุมัติ OT ใน LINE ต้องให้หัวหน้า (เมธี) ผูกบัญชี LINE ก่อน (โครงพร้อม เหมือนลา) · attendance/document flow ต่อยอด descriptor เดิม

#### แก้บั๊ก: ปุ่ม OT ไม่เด้งฟอร์ม (เหมือนลา) — RCA
- **อาการ:** กดปุ่ม "ขอ OT" ใน rich menu แล้วฟอร์มไม่เด้ง (ต่างจาก "ลางาน" ที่เด้งทันที)
- **Root cause (2 ชั้น):** (1) ปุ่ม OT ตั้งเป็น `postback` (ได้การ์ด) ไม่ใช่ `uri` ตรงเหมือนลา; (2) LIFF app ลงทะเบียน endpoint ที่ `/liff/leave` → LINE ให้ login/profile **scope เฉพาะ path ใต้ `/liff/leave`** → `/liff/ot` (ดิบ) อยู่นอก scope → `liff.login()` redirect ไม่ผ่าน ฟอร์มเลยไม่โหลด
- **Fix (ไม่ต้องแตะ LINE console):** เสิร์ฟ OT แบบ in-scope ที่ `/liff/leave/ot` ด้วย `next.config` rewrite → `/liff/ot`; ชี้ปุ่ม rich menu + การ์ดในแชตไปที่ `liff.line.me/{liffId}/ot` (LINE ต่อ path เป็น `/liff/leave/ot`); webhook ใช้ LIFF launcher เมื่อมี `liff_id`
- **verify:** prod `/liff/leave/ot?acct=` 200 เรนเดอร์ `OtFormClient`; live rich menu OT = `uri https://liff.line.me/2010383091-kBSUiU9b/ot`; re-run setup-rich-menu สำเร็จ (`richmenu-56105b…`). **เหลือยืนยันบนมือถือจริงโดย Pong**
- **เผื่ออนาคต:** ฟอร์มใหม่ (ลงเวลา/เอกสาร) เปิดผ่าน `liff.line.me/{id}/<form>` + เพิ่ม rewrite `/liff/leave/<form>` → `/liff/<form>` ได้เลยโดยไม่ต้องลงทะเบียน LIFF ใหม่

#### มาตรฐาน LIFF loading/feedback (ใช้ทุกฟอร์ม + ของใหม่ในอนาคต)
- **เปิดเข้ามาครั้งแรก:** splash เต็มจอ — `LiffLoading` (`src/app/liff/liff-loading.tsx`): tile gradient แบรนด์หายใจ + ripple ring + ไอคอนตามบริบท (ลา=ปฏิทิน, OT=นาฬิกา) + reduced-motion
- **กดส่ง (กำลังส่ง):** **`LiffLoading` เต็มจอเช่นกัน** ข้อความ "กำลังส่งคำขอ…" — render เมื่อ `submitting === true` (ก่อน return ฟอร์ม). Pong ต้องการให้รูปแบบเดียวกับตอนโหลดเข้ามา
- **ส่งสำเร็จ:** **หน้า success เต็มจอ** (checkmark วาด + confetti) — คงไว้ทุกฟอร์ม
- ทำครบทั้ง leave + ot แล้ว; ฟอร์มถัดไปให้ reuse pattern เดียวกัน (3 จังหวะ splash → splash → success ล้วนเต็มจอ)

#### แก้บั๊ก: กดเมนู OT แล้วเห็น "เตรียมฟอร์มลา" แวบก่อน
- **อาการ:** กดปุ่ม OT → เห็น splash "กำลังเตรียมฟอร์มลา" ก่อน แล้วค่อยเป็นฟอร์ม OT
- **สาเหตุ:** LIFF endpoint = `/liff/leave` → เปิด `liff.line.me/{id}/ot` LINE จะโหลดหน้า endpoint (ฟอร์มลา) ก่อนพร้อม `?liff.state=/ot` แล้ว `liff.init()` ค่อย redirect ไป `/liff/leave/ot` (→ rewrite → OT) — หน้าลาเลยโผล่แวบ
- **Fix (ไม่ต้องแตะ console):** `leave/page.tsx` อ่าน `liff.state` จาก searchParams; ถ้าเป็น transit ไปฟอร์มอื่น → `LeaveFormClient` แสดง `LiffLoading` ของ**ปลายทาง** (OT=นาฬิกา "กำลังเตรียมฟอร์ม OT") แทนฟอร์มลา + effect แค่ `liff.init()` เพื่อ redirect → splash ต่อเนื่องไหลลื่นถึงฟอร์ม OT (ไม่เห็น "ลา")
- **verify:** `/liff/leave?...&liff.state=/ot` เรนเดอร์ splash OT (ไม่มี type-grid/ลา); เปิดลาตรงๆ + `liff.state=/` ยังเป็นฟอร์มลาปกติ
- **เผื่ออนาคต:** ฟอร์มอื่น (document/checkin) ก็ได้ splash ปลายทางอัตโนมัติ (เช็ก "non-leave liff.state") — เพิ่ม mapping ไอคอน/ข้อความใน `leave-form-client` ได้

### 2026-06-13 — Phase 3: Approval Workflow (ลา) ✅
- **`src/lib/approval.ts`** — engine: `instantiateLeaveApproval` (อ่าน workflow leave → สร้าง `leave_approval_steps` resolve approver: manager→`manager_id`, role→หาคน role, specific_user, department_head; unresolved=skip; set `workflow_id`+`current_step`; แจ้ง approver แรก) + `actOnLeaveRequest` (approve→เลื่อน step ถัดไป/จบ, reject→จบ; แจ้งพนักงาน/approver ถัดไป; กันทำซ้ำ; `requireApproverId` ฝั่ง LINE)
- **Flex การ์ดอนุมัติ** (`flex.ts`): `approvalRequestFlex` (หัวส้ม + ปุ่ม postback approve/reject) + `approvalResultFlex` (เขียว/แดง ผลถึงพนักงาน)
- **wire**: submit LIFF → instantiate; webhook postback `approve:/reject:<id>` → actOn (auth ด้วย approver id); dashboard actions
- **หน้า `/dashboard/leave`** — filter tabs (ทั้งหมด/รอ/อนุมัติ/ไม่อนุมัติ) + การ์ดคำขอ + อนุมัติ(ConfirmDialog)/ปฏิเสธ(modal+เหตุผล); เมนู sidebar "การลา" ใช้งานจริง
- **org seed** (`seed-org.mjs`): เมธี=manager, ปนัดดา=hr, ผูก manager_id ทีม (เดิมว่างหมด workflow หา approver ไม่ได้)
- **แก้บั๊ก**: actions.ts `holidays.date` → `holiday_date` (คอลัมน์จริง)
- **verify**: route ทดสอบชั่วคราว create→instantiate (step1 เมธี/step2 ปนัดดา resolve ครบ) → approve×2 (step1→step2→approved) → กันซ้ำ ✅ + วราภรณ์ได้การ์ดผลเข้า LINE; screenshot หน้า dashboard ผ่าน design system; tsc สะอาด; ลบ route ทดสอบแล้ว
- **ค้าง**: OT/ลงเวลา/เอกสาร flows (ใช้ engine เดียวกันต่อยอดได้), ปุ่มอนุมัติใน LINE ต้องให้หัวหน้าผูกบัญชี (โครงพร้อม)

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
