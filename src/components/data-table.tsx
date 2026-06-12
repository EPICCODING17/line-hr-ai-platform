"use client";

import { useState } from "react";
import { IconCheck } from "@/components/icons";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
};

export type TableAction = {
  key: string;
  label: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  danger?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  getId: (row: T) => string;
  actions?: TableAction[];
  onAction?: (key: string, ids: string[], clear: () => void) => void;
  emptyIcon?: (p: { className?: string }) => React.ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
};

export function DataTable<T>({
  columns, rows, getId, actions = [], onAction, emptyIcon: EmptyIcon, emptyTitle, emptyHint,
}: Props<T>) {
  const [sel, setSel] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSel((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allOn = rows.length > 0 && rows.every((r) => sel.has(getId(r)));
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.map(getId)));
  const clear = () => setSel(new Set());
  const ids = Array.from(sel);

  if (rows.length === 0) {
    return (
      <div className="tbl-wrap">
        <div className="empty">
          {EmptyIcon && <div className="ic"><EmptyIcon className="" /></div>}
          <p style={{ fontWeight: 600, color: "var(--text)", fontSize: "1.02em" }}>{emptyTitle ?? "ไม่มีข้อมูล"}</p>
          {emptyHint && <p style={{ marginTop: 4, fontSize: ".9em" }}>{emptyHint}</p>}
        </div>
      </div>
    );
  }

  const Cb = ({ on, onClick, label }: { on: boolean; onClick: (e: React.MouseEvent) => void; label: string }) => (
    <span className={`cb${on ? " on" : ""}`} onClick={onClick} role="checkbox" aria-checked={on} aria-label={label} tabIndex={0}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onClick(e as unknown as React.MouseEvent); } }}>
      <IconCheck className="" />
    </span>
  );

  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 44 }}>
                <Cb on={allOn} onClick={(e) => { e.stopPropagation(); toggleAll(); }} label="เลือกทั้งหมด" />
              </th>
              {columns.map((c) => <th key={c.key}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = getId(row);
              const on = sel.has(id);
              return (
                <tr key={id} className={on ? "sel" : ""} onClick={() => toggle(id)}>
                  <td onClick={(e) => { e.stopPropagation(); toggle(id); }}>
                    <Cb on={on} onClick={(e) => { e.stopPropagation(); toggle(id); }} label={`เลือก ${id}`} />
                  </td>
                  {columns.map((c) => <td key={c.key}>{c.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={`floatbar${sel.size > 0 ? " show" : ""}`} role="toolbar" aria-label="จัดการรายการที่เลือก">
        <div className="fb-count"><span className="n">{sel.size}</span> เลือกแล้ว</div>
        <div className="fb-divider" />
        {actions.map((a) => (
          <button key={a.key} className={`fb-btn${a.danger ? " danger" : ""}`} onClick={() => onAction?.(a.key, ids, clear)}>
            <a.Icon className="" /><span>{a.label}</span>
          </button>
        ))}
        <div className="fb-divider" />
        <button className="fb-btn" onClick={clear}><span>ปิด</span></button>
      </div>
    </>
  );
}
