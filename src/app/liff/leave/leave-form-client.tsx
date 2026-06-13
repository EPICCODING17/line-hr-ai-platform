"use client";

import { useEffect, useMemo, useState } from "react";
import { LiffLoading, LeaveLoadingIcon } from "../liff-loading";
import { resolveEmployee, submitLeaveRequest, type LeaveBalance } from "./actions";

export type LeaveTypeOption = {
  id: string;
  name: string;
  color: string | null;
  category: string;
  requiresAttachment: boolean;
};

type Props = {
  acctId: string;
  liffId: string | null;
  devUserId: string | null;
  leaveTypes: LeaveTypeOption[];
};

const LIFF_SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    liff?: any;
  }
}

type Phase =
  | { k: "init" }
  | { k: "needlink" }
  | { k: "error"; msg: string }
  | { k: "ready" }
  | { k: "done"; requestNo: string; totalDays: number };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Mon–Fri count, inclusive. Server re-counts with holidays; this is the live preview. */
function previewWorkingDays(start: string, end: string) {
  if (!start || !end || end < start) return 0;
  let n = 0;
  const d = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (d <= last) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("โหลด LINE SDK ไม่สำเร็จ"));
    document.head.appendChild(s);
  });
}

export function LeaveFormClient({ acctId, liffId, devUserId, leaveTypes }: Props) {
  const [phase, setPhase] = useState<Phase>({ k: "init" });
  const [userId, setUserId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<{ firstName: string; lastName: string; code: string } | null>(null);
  const [balances, setBalances] = useState<Map<string, LeaveBalance>>(new Map());
  const inLiff = !devUserId && !!liffId;

  // form state
  const [typeId, setTypeId] = useState<string>(leaveTypes[0]?.id ?? "");
  const [start, setStart] = useState<string>(todayISO());
  const [end, setEnd] = useState<string>(todayISO());
  const [halfDay, setHalfDay] = useState(false);
  const [period, setPeriod] = useState<"am" | "pm">("am");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const singleDay = start === end;
  const effHalfDay = halfDay && singleDay;
  const totalDays = effHalfDay ? 0.5 : previewWorkingDays(start, end);

  // resolve the LINE user → employee
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let uid = devUserId;
        if (!uid) {
          if (!liffId) {
            if (alive) setPhase({ k: "error", msg: "ยังไม่ได้ตั้งค่า LIFF ID ของบริษัท กรุณาติดต่อ HR" });
            return;
          }
          await loadScript(LIFF_SDK);
          await window.liff.init({ liffId });
          if (!window.liff.isLoggedIn()) {
            window.liff.login();
            return; // browser will redirect
          }
          const profile = await window.liff.getProfile();
          uid = profile.userId as string;
        }
        if (!uid) {
          if (alive) setPhase({ k: "error", msg: "ไม่พบบัญชี LINE" });
          return;
        }
        const res = await resolveEmployee(acctId, uid);
        if (!alive) return;
        if (!res.ok) {
          setPhase(res.reason === "not_linked" ? { k: "needlink" } : { k: "error", msg: "ไม่พบช่องทางของบริษัท" });
          return;
        }
        setUserId(uid);
        setEmployee(res.employee);
        setBalances(new Map(res.balances.map((b) => [b.leaveTypeId, b])));
        setPhase({ k: "ready" });
      } catch (e: any) {
        if (alive) setPhase({ k: "error", msg: e?.message ?? "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [acctId, liffId, devUserId]);

  const selectedType = useMemo(() => leaveTypes.find((t) => t.id === typeId) ?? null, [leaveTypes, typeId]);
  const selectedBalance = typeId ? balances.get(typeId) : undefined;

  async function onSubmit() {
    setFormError(null);
    if (!typeId) return setFormError("กรุณาเลือกประเภทการลา");
    if (!userId) return setFormError("ยังไม่พบบัญชี");
    if (end < start) return setFormError("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
    setSubmitting(true);
    const res = await submitLeaveRequest({
      acctId,
      lineUserId: userId,
      leaveTypeId: typeId,
      startDate: start,
      endDate: end,
      isHalfDay: effHalfDay,
      halfDayPeriod: effHalfDay ? period : null,
      reason: reason.trim(),
    });
    setSubmitting(false);
    if (!res.ok) return setFormError(res.error);
    setPhase({ k: "done", requestNo: res.requestNo, totalDays: res.totalDays });
  }

  function closeWindow() {
    if (inLiff && window.liff?.closeWindow) window.liff.closeWindow();
  }

  // ---------- render ----------
  if (phase.k === "init") return <Loading />;
  if (phase.k === "needlink") return <NeedLink />;
  if (phase.k === "error") return <ErrorState msg={phase.msg} />;
  if (phase.k === "done") return <Success requestNo={phase.requestNo} totalDays={phase.totalDays} inLiff={inLiff} onClose={closeWindow} />;

  return (
    <main className="liff-shell">
      <header className="liff-head">
        {employee && (
          <div className="liff-greet">
            <span className="liff-avatar" aria-hidden>{initials(employee.firstName, employee.lastName)}</span>
            <span className="liff-greet-text">
              <span className="liff-hi">สวัสดีคุณ{employee.firstName} 👋</span>
              <span className="liff-code">{employee.code}</span>
            </span>
          </div>
        )}
        <h1 className="liff-title">ขอลางาน</h1>
        <p className="liff-sub">กรอกรายละเอียดการลา ระบบจะส่งให้หัวหน้าอนุมัติให้โดยอัตโนมัติ</p>
      </header>

      <div className="liff-form">
        {/* leave type */}
        <section className="field">
          <label className="field-label">ประเภทการลา</label>
          <div className="type-grid" role="radiogroup" aria-label="ประเภทการลา">
            {leaveTypes.map((t) => {
              const bal = balances.get(t.id);
              const active = t.id === typeId;
              return (
                <button
                  type="button"
                  key={t.id}
                  role="radio"
                  aria-checked={active}
                  className={`type-chip${active ? " is-active" : ""}`}
                  style={{ ["--c" as string]: t.color ?? "#3c8cf3" }}
                  onClick={() => setTypeId(t.id)}
                >
                  <span className="type-tile" aria-hidden>
                    <CategoryIcon category={t.category} />
                  </span>
                  <span className="type-name">{t.name}</span>
                  {bal && <span className="type-bal">เหลือ {fmt(bal.remaining)} วัน</span>}
                  <span className="type-check" aria-hidden>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* dates */}
        <section className="field">
          <label className="field-label">ช่วงวันที่ลา</label>
          <div className="date-row">
            <label className="date-cell">
              <span className="date-cap">ตั้งแต่</span>
              <input
                type="date"
                className="liff-input"
                value={start}
                onChange={(e) => {
                  const v = e.target.value;
                  setStart(v);
                  if (end < v) setEnd(v);
                }}
              />
            </label>
            <span className="date-arrow" aria-hidden>→</span>
            <label className="date-cell">
              <span className="date-cap">ถึง</span>
              <input
                type="date"
                className="liff-input"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>

          {singleDay && (
            <div className="halfday">
              <label className="switch">
                <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
                <span className="switch-track" aria-hidden><span className="switch-thumb" /></span>
                <span className="switch-text">ลาครึ่งวัน</span>
              </label>
              {halfDay && (
                <div className="seg" role="radiogroup" aria-label="ช่วงครึ่งวัน">
                  <button type="button" role="radio" aria-checked={period === "am"} className={`seg-btn${period === "am" ? " is-active" : ""}`} onClick={() => setPeriod("am")}>เช้า</button>
                  <button type="button" role="radio" aria-checked={period === "pm"} className={`seg-btn${period === "pm" ? " is-active" : ""}`} onClick={() => setPeriod("pm")}>บ่าย</button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* reason */}
        <section className="field">
          <label className="field-label" htmlFor="reason">
            เหตุผล <span className="field-opt">(ไม่บังคับ)</span>
          </label>
          <textarea
            id="reason"
            className="liff-input liff-textarea"
            rows={3}
            maxLength={500}
            placeholder="เช่น พาผู้ปกครองไปโรงพยาบาล"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </section>

        {selectedType?.requiresAttachment && (
          <p className="note-warn">
            การลาประเภทนี้ต้องแนบเอกสารประกอบ — หัวหน้าอาจขอใบรับรองภายหลัง
          </p>
        )}
      </div>

      {/* sticky summary + submit */}
      <footer className="liff-foot">
        <div className="summary">
          <span className="summary-label">รวมวันลา</span>
          <span className="summary-days">
            {fmt(totalDays)} <span className="summary-unit">วันทำงาน</span>
          </span>
          {selectedBalance && totalDays > selectedBalance.remaining && (
            <span className="summary-over">เกินสิทธิ์คงเหลือ ({fmt(selectedBalance.remaining)} วัน)</span>
          )}
        </div>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button type="button" className="liff-submit" disabled={submitting || totalDays <= 0} onClick={onSubmit}>
          {submitting ? (<><span className="liff-spin" aria-hidden />กำลังส่ง…</>) : "ส่งคำขอลา"}
        </button>
      </footer>
    </main>
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function initials(first: string, last: string) {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).trim() || "?";
}

/** A line icon per leave category — colored by the type's own color via --c. */
function CategoryIcon({ category }: { category: string }) {
  const p: Record<string, React.ReactNode> = {
    annual: <><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /><circle cx="12" cy="12" r="3.5" /></>, // sun — vacation
    sick: <path d="M20.8 11.5a5 5 0 0 0-8.8-3 5 5 0 1 0-8.8 3c1.9 2.6 5.9 5.4 8.8 7.5 2.9-2.1 6.9-4.9 8.8-7.5Z" />, // heart
    personal: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>, // person
    maternity: <><circle cx="12" cy="5" r="2.2" /><path d="M12 8.5c-2 0-3 1.5-3 3.5 0 2 1 3 1 4.5M12 8.5c2.4 0 3.2 2 3.5 4 .2 1.5-.6 2.3-1.5 2.3M10 16.5 9 21M13 16h1.5l.5 5" /></>, // baby/parent
    military: <path d="M12 3 5 6v5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3Z" />, // shield
    other: <><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></>, // more
  };
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[category] ?? p.other}
    </svg>
  );
}

function Loading() {
  return <LiffLoading title="กำลังเตรียมฟอร์มลา" sub="แป๊บเดียว กำลังดึงข้อมูลของคุณ" icon={<LeaveLoadingIcon />} />;
}

function NeedLink() {
  return (
    <main className="liff-shell">
      <div className="liff-center">
        <div className="state-icon state-icon--info" aria-hidden>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
        </div>
        <h1 className="state-title">ยังไม่ได้ผูกบัญชี</h1>
        <p className="state-detail">กลับไปที่แชต แล้วพิมพ์ <b>รหัสพนักงาน</b> ของคุณ (เช่น EMP-2026-0001) เพื่อผูกบัญชีก่อนใช้งาน</p>
      </div>
    </main>
  );
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <main className="liff-shell">
      <div className="liff-center">
        <div className="state-icon state-icon--danger" aria-hidden>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></svg>
        </div>
        <h1 className="state-title">เปิดฟอร์มไม่ได้</h1>
        <p className="state-detail">{msg}</p>
      </div>
    </main>
  );
}

function Success({ requestNo, totalDays, inLiff, onClose }: { requestNo: string; totalDays: number; inLiff: boolean; onClose: () => void }) {
  return (
    <main className="liff-shell">
      <div className="liff-center">
        <div className="success-burst" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => <span key={i} className={`confetti c${i}`} />)}
          <div className="state-icon state-icon--ok success-pop">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path className="check-draw" d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        </div>
        <h1 className="state-title">ส่งคำขอลาแล้ว</h1>
        <p className="state-detail">คำขอของคุณถูกส่งให้หัวหน้าอนุมัติเรียบร้อย</p>
        <dl className="receipt">
          <div><dt>เลขที่คำขอ</dt><dd className="tabular">{requestNo}</dd></div>
          <div><dt>รวมวันลา</dt><dd>{fmt(totalDays)} วันทำงาน</dd></div>
          <div><dt>สถานะ</dt><dd><span className="chip-pending">รออนุมัติ</span></dd></div>
        </dl>
        {inLiff && (
          <button type="button" className="liff-submit" onClick={onClose}>ปิดหน้าต่าง</button>
        )}
      </div>
    </main>
  );
}
