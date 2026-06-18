import { Card } from "@/components/ui/card";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { IconUsers, IconLeave, IconClock, IconCheckin, IconTrendUp } from "@/components/icons";

const STATS = [
  { label: "พนักงานทั้งหมด", value: "48", trend: "+2 เดือนนี้", color: "#3c8cf3", Icon: IconUsers, up: true },
  { label: "ลารออนุมัติ", value: "5", trend: "ต้องดำเนินการ", color: "#e8920c", Icon: IconLeave, up: false },
  { label: "OT รออนุมัติ", value: "3", trend: "ต้องดำเนินการ", color: "#745af2", Icon: IconClock, up: false },
  { label: "มาสายวันนี้", value: "2", trend: "จาก 46 คน", color: "#ef5350", Icon: IconCheckin, up: false },
];

const RECENT: { name: string; type: string; status: Status; when: string }[] = [
  { name: "สมชาย ใจดี", type: "ลาป่วย · 1 วัน", status: "pending", when: "5 นาทีที่แล้ว" },
  { name: "วราภรณ์ สุข", type: "OT · 18:00–21:00", status: "approved", when: "1 ชม. ที่แล้ว" },
  { name: "ธนา รักงาน", type: "หนังสือรับรองเงินเดือน", status: "pending", when: "2 ชม. ที่แล้ว" },
  { name: "ก้องภพ มั่นคง", type: "ลาพักร้อน · 2 วัน", status: "rejected", when: "เมื่อวาน" },
  { name: "ปนัดดา ดีงาม", type: "เช็คอิน WFH", status: "completed", when: "เมื่อวาน" },
];

const TODAY = ["อริสา พงษ์", "เมธี ตั้งใจ", "สุดา แก้วใส"];

const PULSE = [
  { label: "LINE webhook", value: "ไว", pct: 96, color: "#05be8a", note: "พร้อมรับคำขอ" },
  { label: "AI routing", value: "fast-path", pct: 82, color: "#745af2", note: "ข้าม AI เมื่อเป็นคำสั่งสั้น" },
  { label: "Approval", value: "สด", pct: 74, color: "#3c8cf3", note: "หัวหน้าเห็นใน LINE" },
];

export default function DashboardOverview() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">ภาพรวม</h1>
          <p className="page-sub">สรุปกิจกรรม HR ของ Demo Co วันนี้</p>
        </div>
      </div>

      <section className="dash-pulse" aria-label="สถานะระบบวันนี้">
        <div className="pulse-copy">
          <span className="pulse-kicker">Live HR pulse</span>
          <h2>LINE, AI และคำขอพร้อมทำงาน</h2>
          <p>สถานะหลักของระบบวันนี้ถูกสรุปให้ HR เห็นทันที โดยไม่ต้องเปิดหลายหน้า</p>
        </div>
        <div className="pulse-mascot" aria-hidden>
          <img src="/brand/hr-mascot-sm.webp" width="104" height="104" alt="" decoding="async" />
        </div>
        <div className="pulse-bars">
          {PULSE.map((p) => (
            <div key={p.label} className="pulse-row" style={{ "--pulse-c": p.color, "--pulse-p": `${p.pct}%` } as React.CSSProperties}>
              <div className="pulse-row-top">
                <span>{p.label}</span>
                <b>{p.value}</b>
              </div>
              <span className="pulse-track"><span /></span>
              <small>{p.note}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="stat-grid" style={{ marginBottom: "var(--gap)" }}>
        {STATS.map((s) => (
          <div key={s.label} className="stat-soft" style={{ "--stat-c": s.color } as React.CSSProperties}>
            <div className="top"><div className="ic"><s.Icon className="" /></div></div>
            <div className="lbl">{s.label}</div>
            <div className="val tabular">{s.value}</div>
            <div className={`trend${s.up ? "" : " muted"}`}>{s.up && <IconTrendUp />}{s.trend}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Card>
          <div className="panel">
            <div className="panel-head">
              <span className="pt">คำขอล่าสุด</span>
              <a href="/dashboard/employees" style={{ fontSize: ".86em", fontWeight: 500, color: "var(--primary)" }}>ดูทั้งหมด</a>
            </div>
            <div className="lst">
              {RECENT.map((r) => (
                <div key={r.name} className="lst-row">
                  <span className="avatar" style={{ width: 36, height: 36, fontSize: 13, background: "var(--accent)" }}>{r.name.charAt(0)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: ".92em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                    <div style={{ fontSize: ".8em", color: "var(--text-faint)" }}>{r.type}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="panel">
            <div className="panel-head"><span className="pt">ลาวันนี้</span><span style={{ fontSize: ".8em", color: "var(--text-faint)" }}>{TODAY.length} คน</span></div>
            <div className="lst">
              {TODAY.map((n) => (
                <div key={n} className="lst-row">
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--success)", flex: "0 0 auto" }} />
                  <span style={{ fontSize: ".92em" }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
