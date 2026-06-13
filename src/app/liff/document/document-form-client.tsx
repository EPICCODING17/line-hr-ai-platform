"use client";

import { useEffect, useMemo, useState } from "react";
import { LiffLoading, DocLoadingIcon } from "../liff-loading";
import { resolveDocEmployee, submitDocRequest } from "./actions";

export type DocTypeOption = {
  id: string;
  code: string;
  name: string;
  requiresSalary: boolean;
};

type Props = {
  acctId: string;
  liffId: string | null;
  devUserId: string | null;
  docTypes: DocTypeOption[];
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
  | { k: "done"; requestNo: string };

// per-type accent colour
const DOC_COLOR: Record<string, string> = {
  employment_certificate: "#3c8cf3",
  work_certificate: "#05be8a",
  salary_certificate: "#745af2",
  payroll_slip: "#e8920c",
  custom_letter: "#6c757d",
};

function thisMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

export function DocFormClient({ acctId, liffId, devUserId, docTypes }: Props) {
  const [phase, setPhase] = useState<Phase>({ k: "init" });
  const [userId, setUserId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<{ firstName: string; lastName: string; code: string } | null>(null);
  const inLiff = !devUserId && !!liffId;

  const [typeId, setTypeId] = useState<string>(docTypes[0]?.id ?? "");
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [refMonth, setRefMonth] = useState<string>(thisMonthValue());
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedType = useMemo(() => docTypes.find((t) => t.id === typeId) ?? null, [docTypes, typeId]);

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
        const res = await resolveDocEmployee(acctId, uid);
        if (!alive) return;
        if (!res.ok) {
          setPhase(res.reason === "not_linked" ? { k: "needlink" } : { k: "error", msg: "ไม่พบช่องทางของบริษัท" });
          return;
        }
        setUserId(uid);
        setEmployee(res.employee);
        setPhase({ k: "ready" });
      } catch (e: any) {
        if (alive) setPhase({ k: "error", msg: e?.message ?? "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [acctId, liffId, devUserId]);

  async function onSubmit() {
    setFormError(null);
    if (!typeId) return setFormError("กรุณาเลือกประเภทเอกสาร");
    if (!userId) return setFormError("ยังไม่พบบัญชี");
    let refM: number | null = null, refY: number | null = null;
    if (selectedType?.requiresSalary) {
      const [y, m] = refMonth.split("-").map(Number);
      if (!y || !m) return setFormError("กรุณาเลือกเดือน/ปีของข้อมูลเงินเดือน");
      refY = y; refM = m;
    }
    setSubmitting(true);
    const res = await submitDocRequest({
      acctId,
      lineUserId: userId,
      documentTypeId: typeId,
      language,
      purpose: purpose.trim(),
      refMonth: refM,
      refYear: refY,
    });
    setSubmitting(false);
    if (!res.ok) return setFormError(res.error);
    setPhase({ k: "done", requestNo: res.requestNo });
  }

  function closeWindow() {
    if (inLiff && window.liff?.closeWindow) window.liff.closeWindow();
  }

  if (phase.k === "init") return <LiffLoading title="กำลังเตรียมฟอร์มเอกสาร" sub="แป๊บเดียว กำลังดึงข้อมูลของคุณ" icon={<DocLoadingIcon />} />;
  if (phase.k === "needlink") return <NeedLink />;
  if (phase.k === "error") return <ErrorState msg={phase.msg} />;
  if (phase.k === "done") return <Success requestNo={phase.requestNo} inLiff={inLiff} onClose={closeWindow} />;
  if (submitting) return <LiffLoading title="กำลังส่งคำขอเอกสาร" sub="กำลังบันทึกและส่งให้ฝ่ายบุคคล…" icon={<DocLoadingIcon />} />;

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
        <h1 className="liff-title">ขอเอกสาร</h1>
        <p className="liff-sub">เลือกประเภทเอกสารที่ต้องการ ระบบจะส่งให้ฝ่ายบุคคลจัดทำให้</p>
      </header>

      <div className="liff-form">
        <section className="field">
          <label className="field-label">ประเภทเอกสาร</label>
          <div className="type-grid" role="radiogroup" aria-label="ประเภทเอกสาร">
            {docTypes.map((t) => {
              const active = t.id === typeId;
              return (
                <button
                  type="button"
                  key={t.id}
                  role="radio"
                  aria-checked={active}
                  className={`type-chip${active ? " is-active" : ""}`}
                  style={{ ["--c" as string]: DOC_COLOR[t.code] ?? "#3c8cf3" }}
                  onClick={() => setTypeId(t.id)}
                >
                  <span className="type-tile" aria-hidden>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
                    </svg>
                  </span>
                  <span className="type-name">{t.name}</span>
                  {t.requiresSalary && <span className="type-bal">ใช้ข้อมูลเงินเดือน</span>}
                  <span className="type-check" aria-hidden>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="field">
          <label className="field-label">ภาษาเอกสาร</label>
          <div className="seg" role="radiogroup" aria-label="ภาษาเอกสาร">
            <button type="button" role="radio" aria-checked={language === "th"} className={`seg-btn${language === "th" ? " is-active" : ""}`} onClick={() => setLanguage("th")}>ภาษาไทย</button>
            <button type="button" role="radio" aria-checked={language === "en"} className={`seg-btn${language === "en" ? " is-active" : ""}`} onClick={() => setLanguage("en")}>English</button>
          </div>
        </section>

        {selectedType?.requiresSalary && (
          <section className="field">
            <label className="field-label" htmlFor="refmonth">เดือน/ปี ของข้อมูล</label>
            <input id="refmonth" type="month" className="liff-input" value={refMonth} onChange={(e) => setRefMonth(e.target.value)} />
          </section>
        )}

        <section className="field">
          <label className="field-label" htmlFor="purpose">
            วัตถุประสงค์ <span className="field-opt">(ไม่บังคับ)</span>
          </label>
          <textarea
            id="purpose"
            className="liff-input liff-textarea"
            rows={3}
            maxLength={500}
            placeholder="เช่น ยื่นขอวีซ่า / ขอสินเชื่อธนาคาร"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </section>
      </div>

      <footer className="liff-foot">
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button type="button" className="liff-submit" disabled={submitting || !typeId} onClick={onSubmit}>
          ส่งคำขอเอกสาร
        </button>
      </footer>
    </main>
  );
}

function initials(first: string, last: string) {
  return ((first?.[0] ?? "") + (last?.[0] ?? "")).trim() || "?";
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

function Success({ requestNo, inLiff, onClose }: { requestNo: string; inLiff: boolean; onClose: () => void }) {
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
        <h1 className="state-title">ส่งคำขอเอกสารแล้ว</h1>
        <p className="state-detail">คำขอของคุณถูกส่งให้ฝ่ายบุคคลดำเนินการเรียบร้อย</p>
        <dl className="receipt">
          <div><dt>เลขที่คำขอ</dt><dd className="tabular">{requestNo}</dd></div>
          <div><dt>สถานะ</dt><dd><span className="chip-pending">รออนุมัติ</span></dd></div>
        </dl>
        {inLiff && (
          <button type="button" className="liff-submit" onClick={onClose}>ปิดหน้าต่าง</button>
        )}
      </div>
    </main>
  );
}
