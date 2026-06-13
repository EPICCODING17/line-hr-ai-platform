import type { ReactNode } from "react";

/** Branded full-screen loading splash shared by every LIFF form.
 *  A breathing gradient mark with concentric ripples — calm, on-brand,
 *  reduced-motion safe. Pass a contextual icon + copy per form. */
export function LiffLoading({
  title = "กำลังเตรียมฟอร์ม",
  sub = "แป๊บเดียว กำลังดึงข้อมูลของคุณ",
  icon,
}: {
  title?: string;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <main className="liff-shell">
      <div className="liff-load" role="status" aria-live="polite" aria-label={title}>
        <div className="liff-load-stage">
          <span className="liff-load-ring" aria-hidden />
          <span className="liff-load-ring r2" aria-hidden />
          <span className="liff-load-mark" aria-hidden>{icon ?? <SparkIcon />}</span>
        </div>
        <div className="liff-load-text">
          <span className="liff-load-title">{title}</span>
          <span className="liff-load-sub">{sub}</span>
        </div>
      </div>
    </main>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

/** Calendar — leave form loading. */
export function LeaveLoadingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5M8 14h3" />
    </svg>
  );
}

/** Clock — OT form loading. */
export function OtLoadingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

/** Document — document form loading. */
export function DocLoadingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

/** Check-in — attendance form loading. */
export function CheckinLoadingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
