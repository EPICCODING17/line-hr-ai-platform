"use client";

import { useEffect, useMemo, useState } from "react";
import {
  OT_RATE_TYPES, OT_RATE_LABEL, autoRateType, otHours, parseHM, fmtHours, type OtRateType,
} from "@/lib/ot";
import { LiffLoading, OtLoadingIcon } from "../liff-loading";
import { resolveOtEmployee, submitOtRequest } from "./actions";

export type OtPolicyInfo = {
  maxPerDay: number | null;
  maxPerMonth: number | null;
  requiresProject: boolean;
  multipliers: Record<OtRateType, number>;
};

type Props = {
  acctId: string;
  liffId: string | null;
  devUserId: string | null;
  policy: OtPolicyInfo;
  holidays: string[];
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
  | { k: "done"; requestNo: string; hours: number };

const RATE_COLOR: Record<OtRateType, string> = {
  normal_day: "#3c8cf3",
  weekend: "#745af2",
  holiday: "#ef5350",
  special: "#e8920c",
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

export function OtFormClient({ acctId, liffId, devUserId, policy, holidays }: Props) {
  const [phase, setPhase] = useState<Phase>({ k: "init" });
  const [userId, setUserId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<{ firstName: string; lastName: string; code: string } | null>(null);
  const [monthHours, setMonthHours] = useState(0);
  const inLiff = !devUserId && !!liffId;
  const holidaySet = useMemo(() => new Set(holidays), [holidays]);

  // form state
  const [otDate, setOtDate] = useState<string>(todayISO());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("21:00");
  const [rateType, setRateType] = useState<OtRateType>(() => autoRateType(todayISO(), holidaySet));
  const [rateTouched, setRateTouched] = useState(false);
  const [reason, setReason] = useState("");
  const [project, setProject] = useState("");
  const [customer, setCustomer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const suggestedRate = useMemo(() => autoRateType(otDate, holidaySet), [otDate, holidaySet]);
  // follow the date's suggestion until the user picks a rate manually
  useEffect(() => {
    if (!rateTouched) setRateType(suggestedRate);
  }, [suggestedRate, rateTouched]);

  const hours = otHours(startTime, endTime);
  const overnight = (() => {
    const s = parseHM(startTime), e = parseHM(endTime);
    return s != null && e != null && e <= s;
  })();
  const overDay = policy.maxPerDay != null && hours > policy.maxPerDay;
  const overMonth = policy.maxPerMonth != null && monthHours + hours > policy.maxPerMonth;

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
            return;
          }
          const profile = await window.liff.getProfile();
          uid = profile.userId as string;
        }
        if (!uid) {
          if (alive) setPhase({ k: "error", msg: "ไม่พบบัญชี LINE" });
          return;
        }
        const res = await resolveOtEmployee(acctId, uid);
        if (!alive) return;
        if (!res.ok) {
          setPhase(res.reason === "not_linked" ? { k: "needlink" } : { k: "error", msg: "ไม่พบช่องทางของบริษัท" });
          return;
        }
        setUserId(uid);
        setEmployee(res.employee);
        setMonthHours(res.monthHours);
        setPhase({ k: "ready" });
      } catch (e: any) {
        if (alive) setPhase({ k: "error", msg: e?.message ?? "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [acctId, liffId, devUserId]);

  function pickRate(rt: OtRateType) {
    setRateTouched(true);
    setRateType(rt);
  }

  async function onSubmit() {
    setFormError(null);
    if (!userId) return setFormError("ยังไม่พบบัญชี");
    if (hours <= 0) return setFormError("ช่วงเวลาไม่ถูกต้อง");
    if (policy.requiresProject && !project.trim()) return setFormError("กรุณาระบุโปรเจกต์/งานที่ทำ OT");
    setSubmitting(true);
    const res = await submitOtRequest({
      acctId,
      lineUserId: userId,
      otDate,
      startTime,
      endTime,
      rateType,
      reason: reason.trim(),
      project: project.trim(),
      customer: customer.trim(),
    });
    setSubmitting(false);
    if (!res.ok) return setFormError(res.error);
    setPhase({ k: "done", requestNo: res.requestNo, hours: res.hours });
  }

  function closeWindow() {
    if (inLiff && window.liff?.closeWindow) window.liff.closeWindow();
  }

  if (phase.k === "init") return <Loading />;
  if (phase.k === "needlink") return <NeedLink />;
  if (phase.k === "error") return <ErrorState msg={phase.msg} />;
  if (phase.k === "done") return <Success requestNo={phase.requestNo} hours={phase.hours} inLiff={inLiff} onClose={closeWindow} />;
  if (submitting) return <LiffLoading title="กำลังส่งคำขอ OT" sub="กำลังบันทึกและส่งให้หัวหน้าอนุมัติ…" icon={<OtLoadingIcon />} />;

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
        <h1 className="liff-title">ขอทำ OT</h1>
        <p className="liff-sub">กรอกรายละเอียดการทำงานล่วงเวลา ระบบจะส่งให้หัวหน้าอนุมัติให้โดยอัตโนมัติ</p>
      </header>

      <div className="liff-form">
        {/* date */}
        <section className="field">
          <label className="field-label" htmlFor="otdate">วันที่ทำ OT</label>
          <input
            id="otdate"
            type="date"
            className="liff-input"
            value={otDate}
            onChange={(e) => setOtDate(e.target.value)}
          />
        </section>

        {/* time range */}
        <section className="field">
          <label className="field-label">ช่วงเวลา</label>
          <div className="date-row">
            <label className="date-cell">
              <span className="date-cap">เริ่ม</span>
              <input type="time" className="liff-input" value={startTime} step={300} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <span className="date-arrow" aria-hidden>→</span>
            <label className="date-cell">
              <span className="date-cap">สิ้นสุด</span>
              <input type="time" className="liff-input" value={endTime} step={300} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
          {overnight && hours > 0 && (
            <p className="ot-hint">🌙 ข้ามคืน — นับถึงเวลาสิ้นสุดของวันถัดไป</p>
          )}
        </section>

        {/* rate type */}
        <section className="field">
          <label className="field-label">อัตรา OT</label>
          <div className="type-grid" role="radiogroup" aria-label="อัตรา OT">
            {OT_RATE_TYPES.map((rt) => {
              const active = rt === rateType;
              const isSuggested = rt === suggestedRate;
              return (
                <button
                  type="button"
                  key={rt}
                  role="radio"
                  aria-checked={active}
                  className={`type-chip${active ? " is-active" : ""}`}
                  style={{ ["--c" as string]: RATE_COLOR[rt] }}
                  onClick={() => pickRate(rt)}
                >
                  <span className="type-tile rate-tile" aria-hidden>×{fmtHours(policy.multipliers[rt])}</span>
                  <span className="type-name">{OT_RATE_LABEL[rt]}</span>
                  {isSuggested && <span className="rate-suggest">แนะนำสำหรับวันนี้</span>}
                  <span className="type-check" aria-hidden>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* project / customer — only when the policy requires it */}
        {policy.requiresProject && (
          <section className="field">
            <label className="field-label" htmlFor="project">โปรเจกต์/งาน</label>
            <input
              id="project"
              className="liff-input"
              maxLength={200}
              placeholder="เช่น ปิดงบไตรมาส 2"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
            <input
              className="liff-input"
              style={{ marginTop: 10 }}
              maxLength={200}
              placeholder="ลูกค้า (ไม่บังคับ)"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
          </section>
        )}

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
            placeholder="เช่น เคลียร์งานค้างก่อนส่งมอบลูกค้า"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </section>

        {policy.maxPerMonth != null && (
          <p className={`ot-month${overMonth ? " is-over" : ""}`}>
            OT เดือนนี้ {fmtHours(monthHours)} / {fmtHours(policy.maxPerMonth)} ชม.
            {overMonth && " · คำขอนี้จะทำให้เกินเพดานเดือน"}
          </p>
        )}
      </div>

      {/* sticky summary + submit */}
      <footer className="liff-foot">
        <div className="summary">
          <span className="summary-label">รวมชั่วโมง</span>
          <span className="summary-days">
            {fmtHours(hours)} <span className="summary-unit">ชม.</span>
          </span>
          {overDay && (
            <span className="summary-over">เกินเพดานต่อวัน ({fmtHours(policy.maxPerDay!)} ชม.)</span>
          )}
        </div>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button type="button" className="liff-submit" disabled={submitting || hours <= 0 || overDay} onClick={onSubmit}>
          ส่งคำขอ OT
        </button>
      </footer>
    </main>
  );
}

function initials(first: string, last: string) {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).trim() || "?";
}

function Loading() {
  return <LiffLoading title="กำลังเตรียมฟอร์ม OT" sub="แป๊บเดียว กำลังดึงข้อมูลของคุณ" icon={<OtLoadingIcon />} />;
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

function Success({ requestNo, hours, inLiff, onClose }: { requestNo: string; hours: number; inLiff: boolean; onClose: () => void }) {
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
        <h1 className="state-title">ส่งคำขอ OT แล้ว</h1>
        <p className="state-detail">คำขอของคุณถูกส่งให้หัวหน้าอนุมัติเรียบร้อย</p>
        <dl className="receipt">
          <div><dt>เลขที่คำขอ</dt><dd className="tabular">{requestNo}</dd></div>
          <div><dt>รวมชั่วโมง</dt><dd>{fmtHours(hours)} ชม.</dd></div>
          <div><dt>สถานะ</dt><dd><span className="chip-pending">รออนุมัติ</span></dd></div>
        </dl>
        {inLiff && (
          <button type="button" className="liff-submit" onClick={onClose}>ปิดหน้าต่าง</button>
        )}
      </div>
    </main>
  );
}
