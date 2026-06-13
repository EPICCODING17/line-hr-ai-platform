// Slot → form pre-fill: validate the AI's extracted slots and shape them into a
// per-form prefill object, encoded into a URL-safe `pre` query param. Decoded
// server-side in each LIFF page. base64url keeps Thai/relative values intact
// through LINE's liff.state redirect for sub-path forms.
import type { Intent, Slots } from "./intent";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const LEAVE_CATEGORIES = ["annual", "sick", "personal", "maternity", "military", "other"];
const DOC_CODES = ["employment_certificate", "salary_certificate", "payroll_slip", "work_certificate", "custom_letter"];

export type LeavePrefill = { category?: string; start?: string; end?: string; half?: "am" | "pm"; reason?: string };
export type OtPrefill = { date?: string; start?: string; end?: string; reason?: string };
export type DocPrefill = { code?: string; language?: "th" | "en"; purpose?: string };

const clean = (s: string | null, max = 500) => (s ? s.trim().slice(0, max) : "");

/** Build a validated prefill object for the matched intent, or null if nothing usable. */
export function buildPrefill(intent: Intent, slots: Slots): LeavePrefill | OtPrefill | DocPrefill | null {
  if (intent === "leave") {
    const p: LeavePrefill = {};
    if (slots.leaveType && LEAVE_CATEGORIES.includes(slots.leaveType)) p.category = slots.leaveType;
    if (slots.startDate && DATE_RE.test(slots.startDate)) p.start = slots.startDate;
    if (slots.endDate && DATE_RE.test(slots.endDate)) p.end = slots.endDate;
    else if (p.start) p.end = p.start;
    if (slots.halfDay === "am" || slots.halfDay === "pm") p.half = slots.halfDay;
    if (slots.reason) p.reason = clean(slots.reason);
    return Object.keys(p).length ? p : null;
  }
  if (intent === "ot") {
    const p: OtPrefill = {};
    if (slots.otDate && DATE_RE.test(slots.otDate)) p.date = slots.otDate;
    if (slots.startTime && TIME_RE.test(slots.startTime)) p.start = slots.startTime;
    if (slots.endTime && TIME_RE.test(slots.endTime)) p.end = slots.endTime;
    if (slots.reason) p.reason = clean(slots.reason);
    return Object.keys(p).length ? p : null;
  }
  if (intent === "document") {
    const p: DocPrefill = {};
    if (slots.docType && DOC_CODES.includes(slots.docType)) p.code = slots.docType;
    if (slots.language === "en") p.language = "en";
    else if (slots.language === "th") p.language = "th";
    if (slots.reason) p.purpose = clean(slots.reason, 200);
    return Object.keys(p).length ? p : null;
  }
  return null;
}

export function encodePrefill(obj: object): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

export function decodePrefill<T>(s: string | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
