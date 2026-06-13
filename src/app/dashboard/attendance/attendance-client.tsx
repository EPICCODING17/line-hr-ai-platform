"use client";

import { useMemo, useState } from "react";

export type AttRow = {
  id: string; employee: string; employeeCode: string; date: string;
  checkIn: string; checkOut: string; worked: string | null; mode: string;
  isLate: boolean; lateMinutes: number; missingOut: boolean;
};

type Filter = "all" | "today" | "late" | "missing";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "today", label: "วันนี้" },
  { key: "late", label: "มาสาย" },
  { key: "missing", label: "ไม่ลงออก" },
];

export function AttendanceClient({ rows, today }: { rows: AttRow[]; today: string }) {
  const [filter, setFilter] = useState<Filter>("all");

  const count = useMemo(() => ({
    all: rows.length,
    today: rows.filter((r) => r.date === today).length,
    late: rows.filter((r) => r.isLate).length,
    missing: rows.filter((r) => r.missingOut).length,
  }), [rows, today]);

  const shown = useMemo(() => {
    switch (filter) {
      case "today": return rows.filter((r) => r.date === today);
      case "late": return rows.filter((r) => r.isLate);
      case "missing": return rows.filter((r) => r.missingOut);
      default: return rows;
    }
  }, [rows, filter, today]);

  const todayCount = count.today;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-h1">ลงเวลา</h1>
          <p className="page-sub">
            {todayCount > 0 ? `วันนี้มีพนักงานลงเวลา ${todayCount} คน` : "วันนี้ยังไม่มีการลงเวลา"}
          </p>
        </div>
      </div>

      <div className="seg-tabs" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            className={`seg-tab${filter === f.key ? " is-active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} <span className="seg-count">{count[f.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="req-empty">ไม่มีรายการลงเวลาในหมวดนี้</div>
      ) : (
        <div className="req-list">
          {shown.map((r) => (
            <article key={r.id} className="req-card">
              <div className="req-top">
                <div className="req-who">
                  <span className="req-avatar" aria-hidden>{(r.employee[0] ?? "?")}</span>
                  <div className="req-whotext">
                    <span className="req-name">{r.employee}</span>
                    <span className="req-code">{r.employeeCode}</span>
                  </div>
                </div>
                <div className="att-chips">
                  {r.isLate && <span className="att-tag late">สาย {r.lateMinutes} นาที</span>}
                  {r.missingOut && <span className="att-tag warn">ยังไม่ลงออก</span>}
                </div>
              </div>

              <div className="req-meta">
                <span className="req-type">{r.date}</span>
                <span className="req-dot">·</span>
                <span>{r.mode}</span>
              </div>

              <div className="att-times">
                <div className="att-time"><span className="att-time-cap">เข้า</span><span className="att-time-val tabular">{r.checkIn}</span></div>
                <span className="att-time-arrow" aria-hidden>→</span>
                <div className="att-time"><span className="att-time-cap">ออก</span><span className="att-time-val tabular">{r.checkOut}</span></div>
                {r.worked && <div className="att-time worked"><span className="att-time-cap">รวม</span><span className="att-time-val">{r.worked}</span></div>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
