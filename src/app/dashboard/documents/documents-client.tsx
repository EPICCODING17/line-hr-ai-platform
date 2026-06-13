"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { approveDocRequest, rejectDocRequest } from "./actions";

export type DocRow = {
  id: string; requestNo: string; employee: string; employeeCode: string;
  type: string; language: string; refPeriod: string | null;
  purpose: string | null; status: Status; createdAt: string;
};

type Filter = "all" | "pending" | "approved" | "rejected";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "pending", label: "รออนุมัติ" },
  { key: "approved", label: "อนุมัติแล้ว" },
  { key: "rejected", label: "ไม่อนุมัติ" },
];

export function DocumentsClient({ rows, canApprove }: { rows: DocRow[]; canApprove: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const shown = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  function doApprove(id: string) {
    setErr(null);
    start(async () => {
      const res = await approveDocRequest(id);
      setApproveId(null);
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }
  function doReject(id: string) {
    setErr(null);
    start(async () => {
      const res = await rejectDocRequest(id, reason);
      setRejectId(null);
      setReason("");
      if (!res.ok) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-h1">เอกสาร</h1>
          <p className="page-sub">
            {pendingCount > 0 ? `มี ${pendingCount} คำขอรออนุมัติ` : "ไม่มีคำขอที่รออนุมัติ"}
          </p>
        </div>
      </div>

      <div className="seg-tabs" role="tablist">
        {FILTERS.map((f) => {
          const n = f.key === "all" ? rows.length : rows.filter((r) => r.status === f.key).length;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={`seg-tab${filter === f.key ? " is-active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span className="seg-count">{n}</span>
            </button>
          );
        })}
      </div>

      {err && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{err}</p>}

      {shown.length === 0 ? (
        <div className="req-empty">ยังไม่มีคำขอเอกสารในหมวดนี้</div>
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
                <StatusBadge status={r.status} />
              </div>

              <div className="req-meta">
                <span className="req-type">{r.type}</span>
                <span className="req-dot">·</span>
                <span>{r.language}</span>
                {r.refPeriod && (<><span className="req-dot">·</span><span className="tabular">{r.refPeriod}</span></>)}
              </div>
              {r.purpose && <p className="req-reason">“{r.purpose}”</p>}

              <div className="req-foot">
                <span className="req-no tabular">{r.requestNo} · {r.createdAt}</span>
                {canApprove && r.status === "pending" && (
                  <div className="req-actions">
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setRejectId(r.id)}>ปฏิเสธ</Button>
                    <Button size="sm" loading={pending && approveId === r.id} onClick={() => setApproveId(r.id)}>อนุมัติ</Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {approveId && (
        <ConfirmDialog
          title="อนุมัติคำขอเอกสาร"
          message="ยืนยันการอนุมัติคำขอนี้? ระบบจะแจ้งผลให้พนักงานทาง LINE ทันที"
          confirmLabel="อนุมัติ"
          loading={pending}
          onConfirm={() => doApprove(approveId)}
          onCancel={() => setApproveId(null)}
        />
      )}

      {rejectId && (
        <div className="modal-scrim" onClick={() => setRejectId(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="ปฏิเสธคำขอเอกสาร">
            <div className="modal-head"><span className="h">ปฏิเสธคำขอเอกสาร</span></div>
            <div className="modal-body">
              <label className="field-label" htmlFor="rej" style={{ display: "block", marginBottom: 8 }}>
                เหตุผล <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(ไม่บังคับ — จะแสดงให้พนักงานเห็น)</span>
              </label>
              <textarea
                id="rej" className="input" style={{ height: "auto", minHeight: 84, padding: "10px 12px" }}
                placeholder="เช่น ขอข้อมูลเพิ่มเติมก่อนออกเอกสาร" value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-outline" onClick={() => setRejectId(null)}>ยกเลิก</button>
              <Button variant="danger" loading={pending} onClick={() => doReject(rejectId)}>ปฏิเสธคำขอ</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
