import { Card } from "@/components/ui/card";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { IconUsers, IconLeave, IconClock, IconCheckin } from "@/components/icons";

const STATS = [
  { label: "พนักงานทั้งหมด", value: "48", trend: "+2 เดือนนี้", color: "var(--brand-blue,#3c8cf3)", Icon: IconUsers },
  { label: "ลารออนุมัติ", value: "5", trend: "ต้องดำเนินการ", color: "#e8920c", Icon: IconLeave },
  { label: "OT รออนุมัติ", value: "3", trend: "ต้องดำเนินการ", color: "#745af2", Icon: IconClock },
  { label: "มาสายวันนี้", value: "2", trend: "จาก 46 คน", color: "#ef5350", Icon: IconCheckin },
];

const RECENT: { name: string; type: string; status: Status; when: string }[] = [
  { name: "สมชาย ใจดี", type: "ลาป่วย · 1 วัน", status: "pending", when: "5 นาทีที่แล้ว" },
  { name: "วราภรณ์ สุข", type: "OT · 18:00–21:00", status: "approved", when: "1 ชม. ที่แล้ว" },
  { name: "ธนา รักงาน", type: "หนังสือรับรองเงินเดือน", status: "pending", when: "2 ชม. ที่แล้ว" },
  { name: "ก้องภพ มั่นคง", type: "ลาพักร้อน · 2 วัน", status: "rejected", when: "เมื่อวาน" },
  { name: "ปนัดดา ดีงาม", type: "เช็คอิน WFH", status: "completed", when: "เมื่อวาน" },
];

const TODAY = ["อริสา พงษ์", "เมธี ตั้งใจ", "สุดา แก้วใส"];

export default function DashboardOverview() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">ภาพรวม</h1>
          <p className="page-sub">สรุปกิจกรรม HR ของ Demo Co วันนี้</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: "var(--gap)" }}>
        {STATS.map((s) => (
          <div key={s.label} className="stat" style={{ "--stat-c": s.color } as React.CSSProperties}>
            <div className="ic"><s.Icon className="" /></div>
            <div className="lbl">{s.label}</div>
            <div className="val tabular">{s.value}</div>
            <div className="trend">{s.trend}</div>
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
