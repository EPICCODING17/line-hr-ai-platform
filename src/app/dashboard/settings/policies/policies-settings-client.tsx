"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconCheckin, IconClock, IconDocument, IconLeave } from "@/components/icons";
import {
  updateAttendancePolicy,
  updateDocumentType,
  updateLeavePolicy,
  updateOtPolicy,
} from "../actions";

export type LeavePolicyRow = {
  id: string;
  name: string;
  quota_days: number;
  accrual: string;
  allow_carry_forward: boolean;
  max_carry_forward: number;
  max_consecutive_days: number | null;
  min_notice_days: number;
  leave_type: {
    id: string;
    name: string;
    code: string;
    category: string;
    is_paid: boolean;
    requires_attachment: boolean;
    attachment_after_days: number | null;
    color: string | null;
  };
};

export type OtPolicyRow = {
  id: string;
  name: string;
  max_hours_per_day: number | null;
  max_hours_per_month: number | null;
  min_request_notice_hours: number;
  requires_project: boolean;
  rates: { rate_type: string; multiplier: number }[];
};

export type AttendancePolicyRow = {
  id: string;
  name: string;
  work_start: string;
  work_end: string;
  late_grace_minutes: number;
  require_gps: boolean;
  require_photo: boolean;
  allow_wfh: boolean;
};

export type DocumentTypeRow = {
  id: string;
  code: string;
  name: string;
  requires_approval: boolean;
  requires_salary: boolean;
  signer_role: string;
};

type Tab = "leave" | "ot" | "attendance" | "documents";
const tabs: { key: Tab; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { key: "leave", label: "ลา", Icon: IconLeave },
  { key: "ot", label: "OT", Icon: IconClock },
  { key: "attendance", label: "ลงเวลา", Icon: IconCheckin },
  { key: "documents", label: "เอกสาร", Icon: IconDocument },
];

export function PoliciesSettingsClient({
  leavePolicies, otPolicies, attendancePolicies, documentTypes,
}: {
  leavePolicies: LeavePolicyRow[];
  otPolicies: OtPolicyRow[];
  attendancePolicies: AttendancePolicyRow[];
  documentTypes: DocumentTypeRow[];
}) {
  const [tab, setTab] = useState<Tab>("leave");

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">นโยบาย</h1>
          <p className="page-sub">ค่าหลักที่ระบบ LINE LIFF และ dashboard ใช้ตรวจสอบคำขอ</p>
        </div>
        <div className="seg grid4" style={{ minWidth: 360 }}>
          {tabs.map((t) => (
            <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
              <t.Icon className="" /><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "leave" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "var(--gap)" }}>
          {leavePolicies.map((p) => <LeavePolicyCard key={p.id} row={p} />)}
          {leavePolicies.length === 0 && <EmptyState title="ยังไม่มีนโยบายลา" />}
        </div>
      )}

      {tab === "ot" && (
        <div style={{ display: "grid", gap: "var(--gap)" }}>
          {otPolicies.map((p) => <OtPolicyCard key={p.id} row={p} />)}
          {otPolicies.length === 0 && <EmptyState title="ยังไม่มีนโยบาย OT" />}
        </div>
      )}

      {tab === "attendance" && (
        <div style={{ display: "grid", gap: "var(--gap)" }}>
          {attendancePolicies.map((p) => <AttendancePolicyCard key={p.id} row={p} />)}
          {attendancePolicies.length === 0 && <EmptyState title="ยังไม่มีนโยบายลงเวลา" />}
        </div>
      )}

      {tab === "documents" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "var(--gap)" }}>
          {documentTypes.map((d) => <DocumentTypeCard key={d.id} row={d} />)}
          {documentTypes.length === 0 && <EmptyState title="ยังไม่มีประเภทเอกสาร" />}
        </div>
      )}
    </>
  );
}

function LeavePolicyCard({ row }: { row: LeavePolicyRow }) {
  const router = useRouter();
  const [form, setForm] = useState({
    id: row.id,
    quota_days: String(row.quota_days),
    min_notice_days: String(row.min_notice_days),
    allow_carry_forward: row.allow_carry_forward,
    max_carry_forward: String(row.max_carry_forward),
    max_consecutive_days: row.max_consecutive_days == null ? "" : String(row.max_consecutive_days),
    is_paid: row.leave_type.is_paid,
    requires_attachment: row.leave_type.requires_attachment,
    attachment_after_days: row.leave_type.attachment_after_days == null ? "" : String(row.leave_type.attachment_after_days),
  });
  const [state, setState] = useSaveState();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ saving: true, error: null, saved: false });
    const res = await updateLeavePolicy({
      id: form.id,
      quota_days: Number(form.quota_days || 0),
      min_notice_days: Number(form.min_notice_days || 0),
      allow_carry_forward: form.allow_carry_forward,
      max_carry_forward: Number(form.max_carry_forward || 0),
      max_consecutive_days: form.max_consecutive_days === "" ? null : Number(form.max_consecutive_days),
      is_paid: form.is_paid,
      requires_attachment: form.requires_attachment,
      attachment_after_days: form.attachment_after_days === "" ? null : Number(form.attachment_after_days),
    });
    if (!res.ok) return setState({ saving: false, error: res.error, saved: false });
    setState({ saving: false, error: null, saved: true });
    router.refresh();
  }

  return (
    <Card>
      <CardBody>
        <PolicyCardHead Icon={IconLeave} title={row.leave_type.name} subtitle={row.leave_type.code || row.name} saved={state.saved} color={row.leave_type.color ?? "var(--primary)"} />
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="โควตา/ปี">
              <input className="input" type="number" min="0" step="0.5" value={form.quota_days} onChange={(e) => setForm((f) => ({ ...f, quota_days: e.target.value }))} />
            </Field>
            <Field label="แจ้งล่วงหน้า (วัน)">
              <input className="input" type="number" min="0" value={form.min_notice_days} onChange={(e) => setForm((f) => ({ ...f, min_notice_days: e.target.value }))} />
            </Field>
            <Field label="สะสมได้สูงสุด">
              <input className="input" type="number" min="0" step="0.5" value={form.max_carry_forward} onChange={(e) => setForm((f) => ({ ...f, max_carry_forward: e.target.value }))} disabled={!form.allow_carry_forward} />
            </Field>
            <Field label="ลาติดต่อกันสูงสุด">
              <input className="input" type="number" min="0" value={form.max_consecutive_days} onChange={(e) => setForm((f) => ({ ...f, max_consecutive_days: e.target.value }))} placeholder="ไม่จำกัด" />
            </Field>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: "var(--gap)" }}>
            <Check label="ได้รับค่าจ้าง" checked={form.is_paid} onChange={(v) => setForm((f) => ({ ...f, is_paid: v }))} />
            <Check label="อนุญาตให้ยกยอดสะสม" checked={form.allow_carry_forward} onChange={(v) => setForm((f) => ({ ...f, allow_carry_forward: v }))} />
            <Check label="ต้องแนบเอกสาร" checked={form.requires_attachment} onChange={(v) => setForm((f) => ({ ...f, requires_attachment: v }))} />
          </div>
          <div style={{ marginTop: "var(--gap)" }}>
            <Field label="แนบเอกสารหลังลาเกิน (วัน)">
              <input className="input" type="number" min="0" value={form.attachment_after_days} onChange={(e) => setForm((f) => ({ ...f, attachment_after_days: e.target.value }))} disabled={!form.requires_attachment} placeholder="ไม่บังคับ" />
            </Field>
          </div>
          <SaveBar saving={state.saving} error={state.error} />
        </form>
      </CardBody>
    </Card>
  );
}

function OtPolicyCard({ row }: { row: OtPolicyRow }) {
  const router = useRouter();
  const [form, setForm] = useState({
    id: row.id,
    max_hours_per_day: row.max_hours_per_day == null ? "" : String(row.max_hours_per_day),
    max_hours_per_month: row.max_hours_per_month == null ? "" : String(row.max_hours_per_month),
    min_request_notice_hours: String(row.min_request_notice_hours),
    requires_project: row.requires_project,
  });
  const [state, setState] = useSaveState();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ saving: true, error: null, saved: false });
    const res = await updateOtPolicy({
      id: form.id,
      max_hours_per_day: form.max_hours_per_day === "" ? null : Number(form.max_hours_per_day),
      max_hours_per_month: form.max_hours_per_month === "" ? null : Number(form.max_hours_per_month),
      min_request_notice_hours: Number(form.min_request_notice_hours || 0),
      requires_project: form.requires_project,
    });
    if (!res.ok) return setState({ saving: false, error: res.error, saved: false });
    setState({ saving: false, error: null, saved: true });
    router.refresh();
  }

  return (
    <Card>
      <CardBody>
        <PolicyCardHead Icon={IconClock} title={row.name} subtitle="ขีดจำกัดและเงื่อนไขการขอ OT" saved={state.saved} color="var(--warning)" />
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="ชั่วโมงสูงสุด/วัน">
              <input className="input" type="number" min="0" step="0.5" value={form.max_hours_per_day} onChange={(e) => setForm((f) => ({ ...f, max_hours_per_day: e.target.value }))} placeholder="ไม่จำกัด" />
            </Field>
            <Field label="ชั่วโมงสูงสุด/เดือน">
              <input className="input" type="number" min="0" step="0.5" value={form.max_hours_per_month} onChange={(e) => setForm((f) => ({ ...f, max_hours_per_month: e.target.value }))} placeholder="ไม่จำกัด" />
            </Field>
            <Field label="แจ้งล่วงหน้า (ชม.)">
              <input className="input" type="number" min="0" value={form.min_request_notice_hours} onChange={(e) => setForm((f) => ({ ...f, min_request_notice_hours: e.target.value }))} />
            </Field>
            <div>
              <label className="field-label">เรต OT</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {row.rates.map((r) => <span key={r.rate_type} className="chip chip-warning">{r.rate_type} {r.multiplier}x</span>)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: "var(--gap)" }}>
            <Check label="ต้องระบุโปรเจกต์/งานที่ทำ" checked={form.requires_project} onChange={(v) => setForm((f) => ({ ...f, requires_project: v }))} />
          </div>
          <SaveBar saving={state.saving} error={state.error} />
        </form>
      </CardBody>
    </Card>
  );
}

function AttendancePolicyCard({ row }: { row: AttendancePolicyRow }) {
  const router = useRouter();
  const [form, setForm] = useState({
    id: row.id,
    work_start: row.work_start,
    work_end: row.work_end,
    late_grace_minutes: String(row.late_grace_minutes),
    require_gps: row.require_gps,
    require_photo: row.require_photo,
    allow_wfh: row.allow_wfh,
  });
  const [state, setState] = useSaveState();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ saving: true, error: null, saved: false });
    const res = await updateAttendancePolicy({
      id: form.id,
      work_start: form.work_start,
      work_end: form.work_end,
      late_grace_minutes: Number(form.late_grace_minutes || 0),
      require_gps: form.require_gps,
      require_photo: form.require_photo,
      allow_wfh: form.allow_wfh,
    });
    if (!res.ok) return setState({ saving: false, error: res.error, saved: false });
    setState({ saving: false, error: null, saved: true });
    router.refresh();
  }

  return (
    <Card>
      <CardBody>
        <PolicyCardHead Icon={IconCheckin} title={row.name} subtitle="เวลาเข้างานและเงื่อนไขเช็คอิน" saved={state.saved} color="var(--success)" />
        <form onSubmit={save}>
          <div className="form-grid">
            <Field label="เริ่มงาน">
              <input className="input" type="time" value={form.work_start} onChange={(e) => setForm((f) => ({ ...f, work_start: e.target.value }))} />
            </Field>
            <Field label="เลิกงาน">
              <input className="input" type="time" value={form.work_end} onChange={(e) => setForm((f) => ({ ...f, work_end: e.target.value }))} />
            </Field>
            <Field label="สายได้ไม่เกิน (นาที)">
              <input className="input" type="number" min="0" value={form.late_grace_minutes} onChange={(e) => setForm((f) => ({ ...f, late_grace_minutes: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: "var(--gap)" }}>
            <Check label="บังคับใช้ GPS" checked={form.require_gps} onChange={(v) => setForm((f) => ({ ...f, require_gps: v }))} />
            <Check label="บังคับถ่ายรูป" checked={form.require_photo} onChange={(v) => setForm((f) => ({ ...f, require_photo: v }))} />
            <Check label="อนุญาต WFH" checked={form.allow_wfh} onChange={(v) => setForm((f) => ({ ...f, allow_wfh: v }))} />
          </div>
          <SaveBar saving={state.saving} error={state.error} />
        </form>
      </CardBody>
    </Card>
  );
}

function DocumentTypeCard({ row }: { row: DocumentTypeRow }) {
  const router = useRouter();
  const [form, setForm] = useState({
    id: row.id,
    requires_approval: row.requires_approval,
    requires_salary: row.requires_salary,
    signer_role: row.signer_role,
  });
  const [state, setState] = useSaveState();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState({ saving: true, error: null, saved: false });
    const res = await updateDocumentType(form);
    if (!res.ok) return setState({ saving: false, error: res.error, saved: false });
    setState({ saving: false, error: null, saved: true });
    router.refresh();
  }

  return (
    <Card>
      <CardBody>
        <PolicyCardHead Icon={IconDocument} title={row.name} subtitle={row.code} saved={state.saved} color="var(--accent)" />
        <form onSubmit={save}>
          <div style={{ display: "grid", gap: 10 }}>
            <Check label="ต้องอนุมัติ" checked={form.requires_approval} onChange={(v) => setForm((f) => ({ ...f, requires_approval: v }))} />
            <Check label="เกี่ยวข้องกับเงินเดือน" checked={form.requires_salary} onChange={(v) => setForm((f) => ({ ...f, requires_salary: v }))} />
          </div>
          <div style={{ marginTop: "var(--gap)" }}>
            <Field label="ผู้ลงนาม">
              <input className="input" value={form.signer_role} onChange={(e) => setForm((f) => ({ ...f, signer_role: e.target.value }))} placeholder="เช่น hr, manager" />
            </Field>
          </div>
          <SaveBar saving={state.saving} error={state.error} />
        </form>
      </CardBody>
    </Card>
  );
}

function useSaveState() {
  return useState<{ saving: boolean; error: string | null; saved: boolean }>({ saving: false, error: null, saved: false });
}

function PolicyCardHead({
  Icon, title, subtitle, saved, color,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  title: string;
  subtitle: string;
  saved: boolean;
  color: string;
}) {
  return (
    <div className="panel-head" style={{ alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", color, background: "color-mix(in srgb, currentColor 12%, var(--surface))", flex: "0 0 auto" }}>
          <Icon className="" />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="pt" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          <div style={{ color: "var(--text-faint)", fontSize: ".82em" }}>{subtitle}</div>
        </div>
      </div>
      {saved && <span className="chip chip-success">บันทึกแล้ว</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-muted)", fontSize: ".92em" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function SaveBar({ saving, error }: { saving: boolean; error: string | null }) {
  return (
    <>
      {error && <p className="helper err" style={{ marginTop: 10 }}>{error}</p>}
      <div className="modal-foot" style={{ paddingInline: 0, paddingBottom: 0, borderTop: "none" }}>
        <Button type="submit" loading={saving}>บันทึก</Button>
      </div>
    </>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="req-empty">
      <p style={{ margin: 0, fontWeight: 600, color: "var(--text)" }}>{title}</p>
      <p style={{ margin: "4px 0 0" }}>ยังไม่พบข้อมูลตั้งต้นของบริษัทนี้</p>
    </div>
  );
}
