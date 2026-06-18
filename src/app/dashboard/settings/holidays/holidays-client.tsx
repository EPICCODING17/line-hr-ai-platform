"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable, type Column, type TableAction } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconClose, IconLeave, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { createHoliday, deleteHolidays, updateHoliday, type HolidayInput } from "../actions";

export type HolidayRow = {
  id: string;
  holiday_date: string;
  name: string;
  is_recurring: boolean;
};

const fmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" });

const columns: Column<HolidayRow>[] = [
  {
    key: "date",
    header: "วันที่",
    render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{fmt.format(new Date(`${r.holiday_date}T00:00:00+07:00`))}</div>
        <div style={{ color: "var(--text-faint)", fontSize: ".82em" }}>{r.holiday_date}</div>
      </div>
    ),
  },
  { key: "name", header: "ชื่อวันหยุด", render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
  {
    key: "recurring",
    header: "ซ้ำทุกปี",
    render: (r) => r.is_recurring ? <span className="chip chip-info">ซ้ำทุกปี</span> : <span style={{ color: "var(--text-faint)" }}>ครั้งเดียว</span>,
  },
];

const actions: TableAction[] = [
  { key: "edit", label: "แก้ไข", Icon: IconPencil },
  { key: "delete", label: "ลบ", Icon: IconTrash, danger: true },
];

export function HolidaysClient({ rows }: { rows: HolidayRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<{ initial?: HolidayRow } | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") setModal({});
  }, [searchParams]);

  async function doDelete() {
    if (!confirm) return;
    setBusy(true);
    const res = await deleteHolidays(confirm.ids);
    setBusy(false);
    if (res.ok) {
      confirm.clear();
      setConfirm(null);
      router.refresh();
      return;
    }
    setConfirm(null);
    alert(res.error);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">วันหยุด</h1>
          <p className="page-sub">{rows.length} วันในปฏิทินบริษัท ใช้คำนวณวันทำงานของ Leave และ OT</p>
        </div>
        <Button size="sm" onClick={() => setModal({})}><IconPlus className="" /> เพิ่มวันหยุด</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getId={(r) => r.id}
        actions={actions}
        onAction={(key, ids, clear) => {
          if (key === "edit") {
            if (ids.length !== 1) { alert("เลือกวันหยุดทีละ 1 รายการเพื่อแก้ไข"); return; }
            setModal({ initial: rows.find((r) => r.id === ids[0]) });
          } else if (key === "delete") {
            setConfirm({ ids, clear });
          }
        }}
        emptyIcon={IconLeave}
        emptyTitle="ยังไม่มีวันหยุด"
        emptyHint="เพิ่มวันหยุดเพื่อให้ระบบคำนวณวันทำงานและ OT ได้ตรงกับบริษัท"
      />

      {modal && (
        <HolidayModal
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); router.refresh(); }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title="ลบวันหยุด"
          message={`ต้องการลบ ${confirm.ids.length} วันหยุดใช่หรือไม่? รายการจะถูกซ่อนจากการคำนวณรอบถัดไป`}
          confirmLabel="ลบ"
          danger
          loading={busy}
          onConfirm={doDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function HolidayModal({
  initial, onClose, onSaved,
}: {
  initial?: HolidayRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<HolidayInput>({
    holiday_date: initial?.holiday_date ?? new Date().toISOString().slice(0, 10),
    name: initial?.name ?? "",
    is_recurring: initial?.is_recurring ?? false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = initial ? await updateHoliday(initial.id, form) : await createHoliday(form);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={initial ? "แก้ไขวันหยุด" : "เพิ่มวันหยุด"}>
        <div className="modal-head">
          <span className="h">{initial ? "แก้ไขวันหยุด" : "เพิ่มวันหยุด"}</span>
          <button className="btn-icon" onClick={onClose} aria-label="ปิด"><IconClose className="" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div>
              <label className="field-label">วันที่ *</label>
              <input className="input" type="date" value={form.holiday_date} onChange={(e) => setForm((f) => ({ ...f, holiday_date: e.target.value }))} required autoFocus />
            </div>
            <div>
              <label className="field-label">ชื่อวันหยุด *</label>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: ".92em" }}>
              <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))} />
              ซ้ำทุกปีในวันและเดือนเดียวกัน
            </label>
            {error && <p className="helper err">{error}</p>}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>ยกเลิก</button>
            <Button type="submit" loading={loading}>{initial ? "บันทึก" : "เพิ่ม"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
