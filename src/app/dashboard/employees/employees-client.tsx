"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable, type Column, type TableAction } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconUsers, IconPencil, IconTrash, IconPlus, IconClose } from "@/components/icons";
import {
  createEmployee, updateEmployee, deleteEmployees, getEmployee,
  type CreateEmployeeInput, type EmployeeDetail,
} from "./actions";

export type Opt = { id: string; name: string };
export type EmployeeRow = { id: string; code: string; name: string; dept: string; position: string; active: boolean };

const EMP_TYPES = [
  { v: "full_time", t: "พนักงานประจำ" }, { v: "part_time", t: "พาร์ทไทม์" },
  { v: "contract", t: "สัญญาจ้าง" }, { v: "probation", t: "ทดลองงาน" }, { v: "intern", t: "ฝึกงาน" },
];

const columns: Column<EmployeeRow>[] = [
  {
    key: "name", header: "พนักงาน",
    render: (e) => (
      <div className="cell-user">
        <span className="avatar">{e.name.charAt(0)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500 }}>{e.name}</div>
          <div style={{ fontSize: ".82em", color: "var(--text-faint)" }}>{e.code}</div>
        </div>
      </div>
    ),
  },
  { key: "dept", header: "แผนก", render: (e) => <span style={{ color: "var(--text-muted)" }}>{e.dept || "—"}</span> },
  { key: "position", header: "ตำแหน่ง", render: (e) => <span style={{ color: "var(--text-muted)" }}>{e.position || "—"}</span> },
  {
    key: "status", header: "สถานะ",
    render: (e) => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: ".88em", color: "var(--text-muted)" }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: e.active ? "var(--success)" : "var(--text-faint)" }} />
        {e.active ? "ทำงานอยู่" : "พักงาน"}
      </span>
    ),
  },
];

const actions: TableAction[] = [
  { key: "edit", label: "แก้ไข", Icon: IconPencil },
  { key: "delete", label: "ลบ", Icon: IconTrash, danger: true },
];

type ModalState = { mode: "create" } | { mode: "edit"; initial: EmployeeDetail } | null;

export function EmployeesClient({ rows, departments, positions }: { rows: EmployeeRow[]; departments: Opt[]; positions: Opt[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [modal, setModal] = useState<ModalState>(null);
  const [confirm, setConfirm] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (sp.get("new") === "1") setModal({ mode: "create" }); }, [sp]);

  async function onAction(key: string, ids: string[], clear: () => void) {
    if (key === "edit") {
      if (ids.length !== 1) { alert("เลือกพนักงานทีละ 1 คนเพื่อแก้ไข"); return; }
      setBusy(true);
      const detail = await getEmployee(ids[0]);
      setBusy(false);
      if (detail) setModal({ mode: "edit", initial: detail });
      else alert("ไม่พบข้อมูลพนักงาน");
    } else if (key === "delete") {
      setConfirm({ ids, clear });
    }
  }

  async function doDelete() {
    if (!confirm) return;
    setBusy(true);
    const res = await deleteEmployees(confirm.ids);
    setBusy(false);
    if (res.ok) { confirm.clear(); setConfirm(null); router.refresh(); }
    else { setConfirm(null); alert(res.error); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">พนักงาน</h1>
          <p className="page-sub">{rows.length} คน · Demo Co</p>
        </div>
        <Button size="sm" onClick={() => setModal({ mode: "create" })}><IconPlus className="" /> เพิ่มพนักงาน</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getId={(e) => e.id}
        actions={actions}
        onAction={onAction}
        emptyIcon={IconUsers}
        emptyTitle="ยังไม่มีพนักงาน"
        emptyHint="กดปุ่ม “เพิ่มพนักงาน” เพื่อเริ่มต้น หรือเชื่อม LINE OA ให้พนักงานลงทะเบียนเอง"
      />

      {confirm && (
        <ConfirmDialog
          title="ลบพนักงาน"
          message={`ต้องการลบพนักงาน ${confirm.ids.length} คนใช่หรือไม่? (สามารถกู้คืนได้จากระบบ)`}
          confirmLabel="ลบ"
          danger
          loading={busy}
          onConfirm={doDelete}
          onCancel={() => setConfirm(null)}
        />
      )}

      {busy && !confirm && <div className="scrim" style={{ background: "transparent", cursor: "wait" }} />}

      {modal && (
        <EmployeeModal
          mode={modal.mode}
          initial={modal.mode === "edit" ? modal.initial : undefined}
          departments={departments}
          positions={positions}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function toForm(d?: EmployeeDetail): CreateEmployeeInput {
  return {
    first_name: d?.first_name ?? "", last_name: d?.last_name ?? "", nickname: d?.nickname ?? "",
    email: d?.email ?? "", phone: d?.phone ?? "", department_id: d?.department_id ?? "",
    position_id: d?.position_id ?? "", employment_type: (d?.employment_type as CreateEmployeeInput["employment_type"]) ?? "full_time",
    start_date: d?.start_date ?? "",
  };
}

function EmployeeModal({ mode, initial, departments, positions, onClose, onSaved }: {
  mode: "create" | "edit"; initial?: EmployeeDetail; departments: Opt[]; positions: Opt[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateEmployeeInput>(() => toForm(initial));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CreateEmployeeInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = mode === "edit" && initial
      ? await updateEmployee(initial.id, form)
      : await createEmployee(form);
    if (!res.ok) { setError(res.error); setLoading(false); return; }
    onSaved();
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={mode === "edit" ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}>
        <div className="modal-head">
          <span className="h">{mode === "edit" ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}</span>
          <button className="btn-icon" onClick={onClose} aria-label="ปิด"><IconClose className="" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-grid">
              <div><label className="field-label">ชื่อ *</label><input className="input" value={form.first_name} onChange={set("first_name")} required autoFocus /></div>
              <div><label className="field-label">นามสกุล *</label><input className="input" value={form.last_name} onChange={set("last_name")} required /></div>
            </div>
            <div><label className="field-label">ชื่อเล่น</label><input className="input" value={form.nickname ?? ""} onChange={set("nickname")} /></div>
            <div className="form-grid">
              <div><label className="field-label">อีเมล</label><input className="input" type="email" value={form.email ?? ""} onChange={set("email")} placeholder="name@company.co" /></div>
              <div><label className="field-label">เบอร์โทร</label><input className="input" value={form.phone ?? ""} onChange={set("phone")} /></div>
            </div>
            <div className="form-grid">
              <div>
                <label className="field-label">แผนก</label>
                <select className="input" value={form.department_id ?? ""} onChange={set("department_id")}>
                  <option value="">— เลือก —</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">ตำแหน่ง</label>
                <select className="input" value={form.position_id ?? ""} onChange={set("position_id")}>
                  <option value="">— เลือก —</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label className="field-label">ประเภทการจ้าง</label>
                <select className="input" value={form.employment_type} onChange={set("employment_type")}>
                  {EMP_TYPES.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}
                </select>
              </div>
              <div><label className="field-label">วันเริ่มงาน</label><input className="input" type="date" value={form.start_date ?? ""} onChange={set("start_date")} /></div>
            </div>
            {error && <p className="helper err">{error}</p>}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>ยกเลิก</button>
            <Button type="submit" loading={loading}>{mode === "edit" ? "บันทึกการแก้ไข" : "บันทึก"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
