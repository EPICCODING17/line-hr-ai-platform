"use client";

import { useEffect, useMemo, useState } from "react";
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
        <div className="liff-head-row">
          <h1 className="liff-title">ขอลางาน</h1>
          {employee && (
            <span className="liff-who" title={employee.code}>
              {employee.firstName} {employee.lastName}
            </span>
          )}
        </div>
        <p className="liff-sub">กรอกรายละเอียดการลา ระบบจะส่งให้หัวหน้าอนุมัติ</p>
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
                  onClick={() => setTypeId(t.id)}
                >
                  <span className="type-dot" style={{ background: t.color ?? "var(--primary)" }} aria-hidden />
                  <span className="type-name">{t.name}</span>
                  {bal && <span className="type-bal">เหลือ {fmt(bal.remaining)} วัน</span>}
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
          {submitting ? "กำลังส่ง…" : "ส่งคำขอลา"}
        </button>
      </footer>
    </main>
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Loading() {
  return (
    <main className="liff-shell">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk-grid">
        <div className="sk sk-chip" /><div className="sk sk-chip" /><div className="sk sk-chip" /><div className="sk sk-chip" />
      </div>
      <div className="sk sk-block" />
      <div className="sk sk-block" />
    </main>
  );
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
        <div className="state-icon state-icon--ok success-pop" aria-hidden>
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
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
