"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DataTable, type Column, type TableAction } from "@/components/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { IconPencil, IconTrash, IconPlus, IconClose, IconBuilding } from "@/components/icons";
import type { NCInput, CrudResult } from "@/lib/crud/types";

export type NCRow = { id: string; name: string; code: string | null; count: number };

type Props = {
  title: string;       // e.g. "แผนก"
  singular: string;    // e.g. "แผนก"
  rows: NCRow[];
  onCreate: (input: NCInput) => Promise<CrudResult>;
  onUpdate: (id: string, input: NCInput) => Promise<CrudResult>;
  onRemove: (ids: string[]) => Promise<CrudResult>;
};

const actions: TableAction[] = [
  { key: "edit", label: "แก้ไข", Icon: IconPencil },
  { key: "delete", label: "ลบ", Icon: IconTrash, danger: true },
];

export function NameCodeCrud({ title, singular, rows, onCreate, onUpdate, onRemove }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<{ initial?: NCRow } | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") setModal({});
  }, [searchParams]);

  const columns: Column<NCRow>[] = [
    { key: "name", header: singular, render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: "code", header: "รหัส", render: (r) => <span style={{ color: "var(--text-faint)" }}>{r.code || "—"}</span> },
    { key: "count", header: "พนักงาน", render: (r) => <span style={{ color: "var(--text-muted)" }}>{r.count} คน</span> },
  ];

  async function doRemove() {
    if (!confirm) return;
    setBusy(true);
    const res = await onRemove(confirm.ids);
    setBusy(false);
    if (res.ok) { confirm.clear(); setConfirm(null); router.refresh(); }
    else { setConfirm(null); alert(res.error); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">{title}</h1>
          <p className="page-sub">{rows.length} {singular} · Demo Co</p>
        </div>
        <Button size="sm" onClick={() => setModal({})}><IconPlus className="" /> เพิ่ม{singular}</Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getId={(r) => r.id}
        actions={actions}
        onAction={(key, ids, clear) => {
          if (key === "edit") {
            if (ids.length !== 1) { alert(`เลือก${singular}ทีละ 1 รายการเพื่อแก้ไข`); return; }
            setModal({ initial: rows.find((r) => r.id === ids[0]) });
          } else if (key === "delete") {
            setConfirm({ ids, clear });
          }
        }}
        emptyIcon={IconBuilding}
        emptyTitle={`ยังไม่มี${singular}`}
        emptyHint={`กดปุ่ม “เพิ่ม${singular}” เพื่อเริ่มต้น`}
      />

      {modal && (
        <NCModal
          singular={singular}
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSubmit={(input) => (modal.initial ? onUpdate(modal.initial.id, input) : onCreate(input))}
          onSaved={() => { setModal(null); router.refresh(); }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={`ลบ${singular}`}
          message={`ต้องการลบ ${confirm.ids.length} ${singular}ใช่หรือไม่? พนักงานที่อยู่ในนี้จะไม่ถูกลบ`}
          confirmLabel="ลบ"
          danger
          loading={busy}
          onConfirm={doRemove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function NCModal({ singular, initial, onClose, onSubmit, onSaved }: {
  singular: string; initial?: NCRow; onClose: () => void;
  onSubmit: (input: NCInput) => Promise<CrudResult>; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await onSubmit({ name, code });
    if (!res.ok) { setError(res.error); setLoading(false); return; }
    onSaved();
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-head">
          <span className="h">{initial ? `แก้ไข${singular}` : `เพิ่ม${singular}`}</span>
          <button className="btn-icon" onClick={onClose} aria-label="ปิด"><IconClose className="" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div><label className="field-label">ชื่อ{singular} *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></div>
            <div><label className="field-label">รหัส</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น ENG, SALES" /></div>
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
