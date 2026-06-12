export type Status =
  | "draft" | "pending" | "approved" | "rejected" | "cancelled" | "completed" | "failed";

const MAP: Record<Status, { label: string; cls: string }> = {
  draft:     { label: "ฉบับร่าง",   cls: "chip-muted" },
  pending:   { label: "รออนุมัติ",  cls: "chip-warning" },
  approved:  { label: "อนุมัติ",    cls: "chip-success" },
  rejected:  { label: "ไม่อนุมัติ", cls: "chip-danger" },
  cancelled: { label: "ยกเลิก",     cls: "chip-muted" },
  completed: { label: "เสร็จสิ้น",  cls: "chip-info" },
  failed:    { label: "ล้มเหลว",    cls: "chip-danger" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = MAP[status];
  return (
    <span className={`chip ${s.cls}`}>
      <span className="dot" style={{ background: "currentColor" }} />
      {s.label}
    </span>
  );
}
