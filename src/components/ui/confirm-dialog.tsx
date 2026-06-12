"use client";

import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  title, message, confirmLabel = "ยืนยัน", danger, loading, onConfirm, onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={title}>
        <div className="modal-head"><span className="h">{title}</span></div>
        <div className="modal-body"><p style={{ color: "var(--text-muted)", fontSize: ".95em", lineHeight: 1.5 }}>{message}</p></div>
        <div className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onCancel}>ยกเลิก</button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
