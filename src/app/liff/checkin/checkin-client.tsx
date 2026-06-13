"use client";

import { useEffect, useState } from "react";
import { LiffLoading, CheckinLoadingIcon } from "../liff-loading";
import { resolveAttendance, checkIn, checkOut, type TodayRecord, type AttResolveResult } from "./actions";

type Props = { acctId: string; liffId: string | null; devUserId: string | null };

const LIFF_SDK = "https://static.line-scdn.net/liff/edge/2/sdk.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    liff?: any;
  }
}

type Policy = { workStart: string; workEnd: string; requireGps: boolean; allowWfh: boolean };

type Phase =
  | { k: "init" }
  | { k: "needlink" }
  | { k: "error"; msg: string }
  | { k: "ready" }
  | { k: "done"; kind: "in" | "out"; timeText: string; late?: boolean; lateMinutes?: number };

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

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { timeout: 8000, enableHighAccuracy: false },
    );
  });
}

const DATE_FMT = new Intl.DateTimeFormat("th-TH", {
  weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok",
});
const CLOCK_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Bangkok",
});

export function CheckinClient({ acctId, liffId, devUserId }: Props) {
  const [phase, setPhase] = useState<Phase>({ k: "init" });
  const [userId, setUserId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<{ firstName: string; lastName: string; code: string } | null>(null);
  const [today, setToday] = useState<TodayRecord | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [workMode, setWorkMode] = useState<"office" | "wfh">("office");
  const [busy, setBusy] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);
  const [clock, setClock] = useState("--:--:--");
  const inLiff = !devUserId && !!liffId;

  // live wall clock (informational, not decoration)
  useEffect(() => {
    const tick = () => setClock(CLOCK_FMT.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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
        const res: AttResolveResult = await resolveAttendance(acctId, uid);
        if (!alive) return;
        if (!res.ok) {
          setPhase(res.reason === "not_linked" ? { k: "needlink" } : { k: "error", msg: "ไม่พบช่องทางของบริษัท" });
          return;
        }
        setUserId(uid);
        setEmployee(res.employee);
        setToday(res.today);
        setPolicy(res.policy);
        if (res.today?.workMode === "wfh") setWorkMode("wfh");
        setPhase({ k: "ready" });
      } catch (e: any) {
        if (alive) setPhase({ k: "error", msg: e?.message ?? "เกิดข้อผิดพลาดในการเชื่อมต่อ" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [acctId, liffId, devUserId]);

  const checkedIn = !!today?.checkInTime;
  const checkedOut = !!today?.checkOutTime;
  const kind: "in" | "out" = checkedIn ? "out" : "in";

  async function onClock() {
    if (!userId) return;
    setActErr(null);
    setBusy(true);
    const pos = policy?.requireGps ? await getPosition() : null;
    const payload = { acctId, lineUserId: userId, workMode, lat: pos?.lat ?? null, lng: pos?.lng ?? null };
    const res = kind === "in" ? await checkIn(payload) : await checkOut(payload);
    setBusy(false);
    if (!res.ok) return setActErr(res.error);
    setPhase({ k: "done", kind: res.kind, timeText: res.timeText, late: res.late, lateMinutes: res.lateMinutes });
  }

  function closeWindow() {
    if (inLiff && window.liff?.closeWindow) window.liff.closeWindow();
  }

  if (phase.k === "init") return <LiffLoading title="กำลังเตรียมลงเวลา" sub="แป๊บเดียว กำลังดึงข้อมูลของคุณ" icon={<CheckinLoadingIcon />} />;
  if (phase.k === "needlink") return <NeedLink />;
  if (phase.k === "error") return <ErrorState msg={phase.msg} />;
  if (busy) return <LiffLoading title="กำลังบันทึกเวลา" sub="แป๊บเดียว กำลังตรวจสอบตำแหน่ง…" icon={<CheckinLoadingIcon />} />;
  if (phase.k === "done") return <Success kind={phase.kind} timeText={phase.timeText} late={phase.late} lateMinutes={phase.lateMinutes} inLiff={inLiff} onClose={closeWindow} />;

  const today2 = today;
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
        <h1 className="liff-title">ลงเวลาทำงาน</h1>
        <p className="liff-sub">{DATE_FMT.format(new Date())}</p>
      </header>

      <div className="clock-hero" aria-hidden>
        <span className="clock-time tabular">{clock}</span>
        <span className="clock-tz">เวลาประเทศไทย</span>
      </div>

      <div className="att-status">
        <div className={`att-row${checkedIn ? " is-on" : ""}`}>
          <span className="att-dot" data-on={checkedIn} aria-hidden />
          <span className="att-label">เข้างาน</span>
          <span className="att-val tabular">{today2?.checkInTime ? timeBkk(today2.checkInTime) : "—"}</span>
          {today2?.isLate && <span className="att-late">สาย {today2.lateMinutes} นาที</span>}
        </div>
        <div className={`att-row${checkedOut ? " is-on" : ""}`}>
          <span className="att-dot" data-on={checkedOut} aria-hidden />
          <span className="att-label">ออกงาน</span>
          <span className="att-val tabular">{today2?.checkOutTime ? timeBkk(today2.checkOutTime) : "—"}</span>
        </div>
      </div>

      {!checkedIn && policy?.allowWfh && (
        <div className="seg" role="radiogroup" aria-label="รูปแบบการทำงาน" style={{ alignSelf: "center" }}>
          <button type="button" role="radio" aria-checked={workMode === "office"} className={`seg-btn${workMode === "office" ? " is-active" : ""}`} onClick={() => setWorkMode("office")}>เข้าออฟฟิศ</button>
          <button type="button" role="radio" aria-checked={workMode === "wfh"} className={`seg-btn${workMode === "wfh" ? " is-active" : ""}`} onClick={() => setWorkMode("wfh")}>ทำงานที่บ้าน</button>
        </div>
      )}

      <footer className="liff-foot">
        {actErr && <p className="form-error" role="alert">{actErr}</p>}
        {checkedOut ? (
          <div className="att-done">เสร็จสิ้นการลงเวลาสำหรับวันนี้แล้ว 🎉</div>
        ) : (
          <button type="button" className={`liff-submit clock-btn ${kind}`} onClick={onClock}>
            {kind === "in" ? "เช็คอินเข้างาน" : "เช็คเอาท์ออกงาน"}
          </button>
        )}
        {policy?.requireGps && !checkedOut && (
          <p className="att-note">ระบบจะขอตำแหน่ง GPS เพื่อยืนยันการลงเวลา</p>
        )}
      </footer>
    </main>
  );
}

function timeBkk(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(iso));
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
        <h1 className="state-title">เปิดหน้าลงเวลาไม่ได้</h1>
        <p className="state-detail">{msg}</p>
      </div>
    </main>
  );
}

function Success({ kind, timeText, late, lateMinutes, inLiff, onClose }: { kind: "in" | "out"; timeText: string; late?: boolean; lateMinutes?: number; inLiff: boolean; onClose: () => void }) {
  const isIn = kind === "in";
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
        <h1 className="state-title">{isIn ? "ลงเวลาเข้างานแล้ว" : "ลงเวลาออกงานแล้ว"}</h1>
        <p className="state-detail">
          {isIn
            ? (late ? `บันทึกเวลาเข้างาน ${timeText} (สาย ${lateMinutes} นาที)` : `บันทึกเวลาเข้างาน ${timeText} ตรงเวลา 🙌`)
            : `บันทึกเวลาออกงาน ${timeText} · ขอบคุณสำหรับวันนี้ 🙌`}
        </p>
        {inLiff && (
          <button type="button" className="liff-submit" onClick={onClose}>ปิดหน้าต่าง</button>
        )}
      </div>
    </main>
  );
}
