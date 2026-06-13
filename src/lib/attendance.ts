// Shared attendance helpers — pure, usable on server and client.
// Thailand is UTC+7 year-round.

export const WORK_MODE_LABEL: Record<string, string> = {
  office: "เข้าออฟฟิศ",
  wfh: "ทำงานที่บ้าน",
  onsite: "ออกหน้างาน",
  business_trip: "ออกนอกสถานที่",
};

export function workModeLabel(m: string): string {
  return WORK_MODE_LABEL[m] ?? m;
}

const BKK_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

/** Current Bangkok date + minutes-since-midnight, plus the UTC instant. */
export function bangkokNow(): { date: string; minutes: number; iso: string } {
  const parts = BKK_PARTS.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  let hh = Number(get("hour"));
  if (hh === 24) hh = 0; // some engines emit 24 at midnight
  return { date, minutes: hh * 60 + Number(get("minute")), iso: new Date().toISOString() };
}

const HHMM_BKK = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok",
});

/** Format a stored timestamp as "HH:MM" (Bangkok). */
export function formatTimeBkk(iso: string | null | undefined): string {
  if (!iso) return "—";
  return HHMM_BKK.format(new Date(iso));
}

/** "09:00" / "09:00:00" → minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Worked duration between two stored timestamps, as "Xh Ym". */
export function workedDuration(inIso: string | null, outIso: string | null): string | null {
  if (!inIso || !outIso) return null;
  const mins = Math.round((new Date(outIso).getTime() - new Date(inIso).getTime()) / 60000);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}
