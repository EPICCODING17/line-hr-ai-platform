// Shared OT helpers — pure functions usable on both server and client.
// Thailand is UTC+7 year-round (no DST), so a fixed +07:00 offset is safe.

export const OT_RATE_TYPES = ["normal_day", "weekend", "holiday", "special"] as const;
export type OtRateType = (typeof OT_RATE_TYPES)[number];

export const OT_RATE_LABEL: Record<OtRateType, string> = {
  normal_day: "วันธรรมดา",
  weekend: "เสาร์–อาทิตย์",
  holiday: "วันหยุดนักขัตฤกษ์",
  special: "กรณีพิเศษ",
};

/** Statutory Thai OT defaults; overridden per-tenant by ot_rates. */
export const OT_DEFAULT_MULTIPLIER: Record<OtRateType, number> = {
  normal_day: 1.5,
  weekend: 2,
  holiday: 3,
  special: 3,
};

export function isOtRateType(v: string): v is OtRateType {
  return (OT_RATE_TYPES as readonly string[]).includes(v);
}

export function otRateLabel(rt: string): string {
  return isOtRateType(rt) ? OT_RATE_LABEL[rt] : "OT";
}

/** "HH:MM" → minutes since midnight, or null if malformed. */
export function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Hours between start and end (overnight-aware), rounded to 2dp. */
export function otHours(startHM: string, endHM: string): number {
  const s = parseHM(startHM), e = parseHM(endHM);
  if (s == null || e == null) return 0;
  let mins = e - s;
  if (mins <= 0) mins += 24 * 60; // crosses midnight → next day
  return Math.round((mins / 60) * 100) / 100;
}

/** Auto rate class from the OT date: holiday > weekend > weekday. */
export function autoRateType(dateISO: string, holidays: Set<string>): OtRateType {
  if (holidays.has(dateISO)) return "holiday";
  const dow = new Date(`${dateISO}T00:00:00Z`).getUTCDay(); // 0 Sun .. 6 Sat
  if (dow === 0 || dow === 6) return "weekend";
  return "normal_day";
}

/** Build timestamptz strings (Asia/Bangkok) for the request; rolls end to the
 *  next day when it is at/Before start. */
export function otTimestamps(dateISO: string, startHM: string, endHM: string): { start: string; end: string } {
  const s = parseHM(startHM), e = parseHM(endHM);
  let endDate = dateISO;
  if (s != null && e != null && e <= s) {
    const d = new Date(`${dateISO}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    endDate = d.toISOString().slice(0, 10);
  }
  return { start: `${dateISO}T${startHM}:00+07:00`, end: `${endDate}T${endHM}:00+07:00` };
}

const HHMM_BKK = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok",
});

/** Format a stored start/end timestamp pair as "HH:MM – HH:MM" (Bangkok). */
export function formatOtTimeRange(startIso: string, endIso: string): string {
  return `${HHMM_BKK.format(new Date(startIso))} – ${HHMM_BKK.format(new Date(endIso))}`;
}

export function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(n * 10 % 1 === 0 ? 1 : 2);
}
