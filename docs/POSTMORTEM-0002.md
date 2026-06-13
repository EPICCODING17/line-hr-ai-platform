# POSTMORTEM-0002 — ปุ่ม LIFF ฟอร์มที่ไม่ใช่ "ลา" เปิดไม่ติด / โชว์ฟอร์มลาแวบก่อน

> เอกสารบันทึก root cause สำหรับวิศวกร — 2 บั๊กที่เกี่ยวเนื่องกัน ทั้งคู่มาจากการที่ทั้งระบบมี **LIFF app เดียว** ลงทะเบียน endpoint ไว้ที่ `/liff/leave`

---

## 1. Summary _(mandatory)_

ระบบลงทะเบียน LIFF app เพียงตัวเดียว โดยตั้ง **endpoint = `/liff/leave`** ตั้งแต่ตอนทำฟอร์มลา (Phase 2) พอเพิ่มฟอร์ม OT (และต่อมา เอกสาร/ลงเวลา) ที่ route แยก (`/liff/ot` ฯลฯ) เกิด 2 อาการ: **(บั๊ก A)** ปุ่ม "ขอ OT" ใน rich menu เปิดฟอร์มไม่ติด เพราะ `/liff/ot` อยู่นอก LIFF login/profile scope ของ endpoint `/liff/leave`; **(บั๊ก B)** หลังแก้บั๊ก A แล้ว กดปุ่ม OT เห็น splash "กำลังเตรียมฟอร์มลา" แวบหนึ่งก่อนเป็นฟอร์ม OT เพราะ LINE โหลดหน้า endpoint (ฟอร์มลา) ก่อนเสมอแล้วค่อย redirect. แก้โดยเสิร์ฟทุกฟอร์มให้อยู่ "ใน scope" ของ endpoint ผ่าน rewrite `/liff/leave/<form>` → `/liff/<form>` + เปิดผ่าน `liff.line.me/{id}/<form>`, และให้หน้า endpoint ตรวจ `liff.state` เพื่อโชว์ splash ของปลายทางแทนฟอร์มลา. Fix: commit `7c9d5b3` (บั๊ก A) + `251726f` (บั๊ก B). Owner: ลูฟี่/Pong.

---

## 2. Symptom

- **บั๊ก A:** แตะปุ่ม "ขอ OT" ใน rich menu → ไม่มีฟอร์มเด้งขึ้น (ต่างจากปุ่ม "ลางาน" ที่เปิดฟอร์มทันที). ถ้าไปทางการ์ด+ปุ่มในแชต ก็เปิด `/liff/ot` แล้วค้าง/ไม่โหลด
- **บั๊ก B:** แตะปุ่ม "ขอ OT" → เห็นหน้า splash **"กำลังเตรียมฟอร์มลา"** (ไอคอนปฏิทิน) แวบหนึ่ง แล้วค่อยกลายเป็นฟอร์ม OT — ผู้ใช้ถามว่า "ทำไมมันแสดงว่าเตรียมข้อมูลการลาก่อน มันเรียงตามลำดับเหรอ"

---

## 3. Root cause _(mandatory)_

**ต้นตอร่วม:** LIFF app ลงทะเบียน endpoint เดียวที่ `https://<host>/liff/leave?acct=...` (ดู PROGRESS Phase 2). LINE ให้สิทธิ์ LIFF (login redirect + `getProfile`) **เฉพาะ URL ที่อยู่ใต้ path ของ endpoint** เท่านั้น คือใต้ `/liff/leave` — path อื่นเช่น `/liff/ot` อยู่นอก scope

**บั๊ก A — 2 ชั้น:**
1. ใน `scripts/setup-rich-menu.mjs` ปุ่ม "ลางาน" ตั้งเป็น `{ type: "uri", uri: "https://liff.line.me/{liffId}" }` (เปิด endpoint = ฟอร์มลา ตรง) แต่ปุ่ม OT ตั้งเป็น `{ type: "postback", data: "action=ot" }` → ได้แค่การ์ด ไม่ใช่ฟอร์ม
2. ปุ่มในการ์ด (และ `otLink()` ใน webhook) ชี้ไป raw URL `${baseUrl}/liff/ot?acct=...`. เมื่อเปิดนอก LINE context, `leave-form-client`/`ot-form-client` เรียก `window.liff.init()` แล้ว `liff.login()` จะ redirect ด้วย `redirect_uri = /liff/ot` ซึ่ง**อยู่นอก scope ของ endpoint `/liff/leave`** → LINE ปฏิเสธ → ฟอร์มไม่โหลด

**บั๊ก B:** หลังบั๊ก A แก้ให้ปุ่ม OT = `https://liff.line.me/{liffId}/ot` แล้ว — กลไก LIFF คือ LINE เปิดหน้า **endpoint URL ก่อนเสมอ** (`/liff/leave`) พร้อม query `?liff.state=%2Fot` จากนั้น `liff.init()` จึงอ่าน `liff.state` แล้ว redirect ไป `/liff/leave/ot`. ช่วงที่หน้า `/liff/leave` ถูกโหลด `LeaveFormClient` เข้า phase `"init"` แล้ว render `<Loading/>` = splash **"กำลังเตรียมฟอร์มลา"** → ผู้ใช้จึงเห็นฟอร์มลาแวบก่อน

---

## 4. Why it produced the symptom

ทั้งสองอาการเกิดเพราะ "ทางเข้า" ของทุกฟอร์มต้องผ่าน endpoint `/liff/leave`:
- บั๊ก A: เพราะปลายทาง `/liff/ot` อยู่นอก path ของ endpoint, ขั้น `liff.login()` redirect (ซึ่งจำเป็นเมื่อยังไม่ได้ login ใน webview) ถูก LINE บล็อก — อาการคือ "เปิดไม่ติด" ไม่ใช่ error ชัด ๆ เพราะค้างที่ขั้น redirect
- บั๊ก B: เพราะ LINE บังคับโหลด endpoint (`/liff/leave`) ก่อน redirect — หน้า endpoint นั้น "คือ" ฟอร์มลา จึงโชว์ loading ของลาออกมาเป็น UI ตัวแรกเสมอ ไม่ว่าปลายทางจริงจะเป็นฟอร์มไหน

---

## 5. Fix _(mandatory)_

**บั๊ก A — commit `7c9d5b3`:** ทำให้ปลายทาง OT อยู่ "ใน scope" ของ endpoint โดยไม่ต้องแก้ค่า endpoint ใน LINE console:
- `next.config.ts` เพิ่ม rewrite `/liff/leave/ot` → `/liff/ot` (path `/liff/leave/ot` อยู่ใต้ `/liff/leave` = in-scope)
- `setup-rich-menu.mjs` เปลี่ยนปุ่ม OT เป็น `{ type: "uri", uri: "https://liff.line.me/{liffId}/ot" }` — LINE จะต่อ path เป็น `{endpoint}/ot` = `/liff/leave/ot` → rewrite → ฟอร์ม OT จริง
- `webhook/[id]/route.ts` `otLink()`/`leaveLink()` ใช้ LIFF launcher (`liff.line.me/{id}/...`) เมื่อมี `liff_id` แทน raw URL → ปุ่มในแชตก็ in-scope

แก้ที่ราก (ทำให้ path in-scope) ไม่ใช่ซ่อนอาการ — `liff.login()` redirect_uri ตอนนี้คือ `/liff/leave/ot` ซึ่งผ่าน scope check จริง

**บั๊ก B — commit `251726f`:** ให้หน้า endpoint รู้ตัวว่ากำลังเป็น "ทางผ่าน":
- `liff/leave/page.tsx` อ่าน `searchParams["liff.state"]`; ถ้าเป็น path ของฟอร์มอื่น (ไม่มีคำว่า leave) → ส่ง prop `transitTarget` ให้ client (และข้าม query `leave_types` ที่ไม่ต้องใช้)
- `leave-form-client.tsx` ถ้า `transitTarget` มีค่า → render `<LiffLoading/>` ของ **ปลายทาง** (เช่น OT = ไอคอนนาฬิกา "กำลังเตรียมฟอร์ม OT") แทนฟอร์มลา; `useEffect` แค่เรียก `liff.init()` เพื่อให้ redirect ทำงาน
- ผลคือ splash ต่อเนื่องเป็นข้อความ/ไอคอนเดียวกันตั้งแต่ endpoint จนถึงฟอร์มปลายทาง ผู้ใช้ไม่เห็นคำว่า "ลา"

---

## 6. How it was found

- **repro:** ผู้ใช้แตะปุ่มจริงในมือถือ — บั๊ก A "ไม่เด้งฟอร์ม", บั๊ก B "เห็นลาแวบก่อน" ทั้งคู่ reproduce ได้ทุกครั้ง
- **เครื่องมือ:** อ่าน live rich menu definition ผ่าน LINE API (`/v2/bot/richmenu/list`) ยืนยันว่า leave = `uri`, ot = `postback` → ชี้บั๊ก A ชั้นที่ 1 ชัด ๆ; trace `setup-rich-menu.mjs` + webhook `otLink` เจอ raw URL → ชั้นที่ 2 (scope)
- **สมมติฐานบั๊ก B ที่ยืนยัน:** "หน้า endpoint ลาถูกโหลดก่อน" — หลักฐานคือผู้ใช้เห็นข้อความ "ลา" (ซึ่ง render เฉพาะใน `LeaveFormClient`) → endpoint ลาถูกโหลดจริง; ตรงกับพฤติกรรม `liff.state` ที่ documented
- **การทดลองชี้ขาด:** `curl "/liff/leave?acct=...&liff.state=%2Fot"` (จำลองสิ่งที่ LINE ทำ) บน dev → หน้า render `OtFormClient`/`liff-load-mark` + ข้อความ "กำลังเตรียมฟอร์ม OT" โดย**ไม่มี** `type-grid`/ฟอร์มลา = fix ทำงานตามกลไกจริง

---

## 7. Why it slipped through

**Latent + workload gap.** ตอน Phase 2 มีฟอร์มเดียว (ลา) การตั้ง endpoint = `/liff/leave` ถูกต้องและเปิดฟอร์มลาได้ดี ไม่มีบั๊ก. ข้อจำกัด scope ของ LIFF (ทุกฟอร์มต้องอยู่ใต้ path เดียว) ไม่เคยถูกชนจนกระทั่งเพิ่ม route ฟอร์มที่ 2 (`/liff/ot`) — workload แรกที่ออกนอก `/liff/leave`. ไม่มี automated test ครอบ LIFF launch/scope (เป็น integration กับ LINE ที่ทดสอบยากแบบ headless) — ตรวจเจอตอนผู้ใช้แตะจริงเท่านั้น

---

## 8. Validation _(mandatory)_

- **บั๊ก A:** ผู้ใช้ยืนยันเอง ("ได้แล้ว") ว่าปุ่ม OT เปิดฟอร์มได้หลัง deploy; ฝั่ง server: live rich menu OT = `uri .../ot` (ยืนยันผ่าน LINE API), prod `/liff/leave/ot?acct=` คืน 200 render `OtFormClient`
- **บั๊ก B:** ยืนยันด้วย repro ฝั่ง server (จำลอง LINE): `/liff/leave?...&liff.state=%2Fot` render splash OT (screenshot ผ่าน ไม่มีฟอร์มลา); เปิดลาตรง ๆ และ `liff.state=/` ยังเป็นฟอร์มลาปกติ. **ยังไม่ได้ให้ผู้ใช้ยืนยันบนมือถือซ้ำหลัง fix บั๊ก B** — validate ด้วยการ reproduce กลไก `liff.state` ฝั่ง server เท่านั้น
- ครอบคลุมเฉพาะ Demo Co + LIFF `2010383091-kBSUiU9b`; tsc + `next build` สะอาดทุกครั้ง

---

## 9. Action items / follow-ups

- รูปแบบนี้ scale ไปฟอร์มใหม่แล้ว: เอกสาร/ลงเวลา เปิดผ่าน `liff.line.me/{id}/{document,checkin}` + rewrite `/liff/leave/{form}` + `leave-form-client` transit map รองรับ `document`/`checkin` (ทำใน commit `7153a3a`)
- **ค้าง:** ถ้าจะให้ "สะอาด" ระยะยาว ควรย้าย LIFF endpoint เป็น `/liff` (root dispatcher) แล้วเลิกพึ่ง rewrite `/liff/leave/<form>` — ต้องให้ Pong แก้ค่า endpoint ใน LINE Login channel 1 ช่อง (ยังไม่ทำ เพราะวิธีปัจจุบันได้ผลและไม่ต้องแตะ console)
- **ค้าง:** ยังไม่มี automated check สำหรับ LIFF deep-link/scope — เป็น manual test บนมือถือ
