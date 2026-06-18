"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconBuilding, IconCheckin, IconDocument, IconSettings } from "@/components/icons";
import { updateCompanySettings, type CompanySettingsInput } from "../actions";

export type CompanyTenantInfo = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_id: string | null;
  logo_url: string | null;
  status: string;
};

export type CompanySettingsInfo = {
  timezone: string;
  locale: string;
  workweek: number[];
  theme: string;
};

export type CompanyLineInfo = {
  basic_id: string | null;
  liff_id: string | null;
  channel_id: string | null;
  is_active: boolean;
  updated_at: string | null;
};

type SubscriptionInfo = {
  status: string | null;
  planName: string | null;
  planCode: string | null;
  currentPeriodEnd: string | null;
};

const DAYS = [
  { value: 1, label: "จ" },
  { value: 2, label: "อ" },
  { value: 3, label: "พ" },
  { value: 4, label: "พฤ" },
  { value: 5, label: "ศ" },
  { value: 6, label: "ส" },
  { value: 7, label: "อา" },
];

export function CompanySettingsClient({
  tenant, settings, line, subscription,
}: {
  tenant: CompanyTenantInfo;
  settings: CompanySettingsInfo;
  line: CompanyLineInfo | null;
  subscription: SubscriptionInfo;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CompanySettingsInput>({
    name: tenant.name,
    slug: tenant.slug,
    legal_name: tenant.legal_name ?? "",
    tax_id: tenant.tax_id ?? "",
    timezone: settings.timezone,
    locale: settings.locale,
    workweek: settings.workweek.length ? settings.workweek : [1, 2, 3, 4, 5],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof CompanySettingsInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const toggleDay = (day: number) => {
    setSaved(false);
    setForm((f) => {
      const days = new Set(f.workweek ?? []);
      days.has(day) ? days.delete(day) : days.add(day);
      return { ...f, workweek: Array.from(days).sort((a, b) => a - b) };
    });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await updateCompanySettings(form);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-h1">ข้อมูลบริษัท</h1>
          <p className="page-sub">ตั้งค่าข้อมูลหลักที่ dashboard และ LIFF ใช้ร่วมกัน</p>
        </div>
        <span className="chip chip-info"><span className="dot" style={{ background: "currentColor" }} />{tenant.status}</span>
      </div>

      <div className="grid-2">
        <Card>
          <CardBody>
            <div className="panel-head">
              <span className="pt">โปรไฟล์บริษัท</span>
              {saved && <span className="chip chip-success">บันทึกแล้ว</span>}
            </div>
            <form onSubmit={submit}>
              <div className="form-grid">
                <div>
                  <label className="field-label">ชื่อบริษัท *</label>
                  <input className="input" value={form.name} onChange={set("name")} required autoFocus />
                </div>
                <div>
                  <label className="field-label">Slug *</label>
                  <input className="input" value={form.slug} onChange={set("slug")} required />
                </div>
              </div>
              <div className="form-grid" style={{ marginTop: "var(--gap)" }}>
                <div>
                  <label className="field-label">ชื่อนิติบุคคล</label>
                  <input className="input" value={form.legal_name ?? ""} onChange={set("legal_name")} />
                </div>
                <div>
                  <label className="field-label">เลขประจำตัวผู้เสียภาษี</label>
                  <input className="input" value={form.tax_id ?? ""} onChange={set("tax_id")} />
                </div>
              </div>
              <div className="form-grid" style={{ marginTop: "var(--gap)" }}>
                <div>
                  <label className="field-label">Timezone</label>
                  <select className="input" value={form.timezone} onChange={set("timezone")}>
                    <option value="Asia/Bangkok">Asia/Bangkok</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Locale</label>
                  <select className="input" value={form.locale} onChange={set("locale")}>
                    <option value="th">ไทย</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: "var(--gap)" }}>
                <label className="field-label">วันทำงาน</label>
                <div className="seg grid4" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
                  {DAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      className={form.workweek?.includes(d.value) ? "on" : ""}
                      onClick={() => toggleDay(d.value)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="helper err" style={{ marginTop: 10 }}>{error}</p>}
              <div className="modal-foot" style={{ paddingInline: 0, paddingBottom: 0, borderTop: "none" }}>
                <Button type="submit" loading={saving}>บันทึกข้อมูลบริษัท</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div style={{ display: "grid", gap: "var(--gap)" }}>
          <InfoCard
            Icon={IconBuilding}
            title="แพ็กเกจ"
            main={subscription.planName ?? "ยังไม่พบแพ็กเกจ"}
            detail={subscription.status ? `สถานะ ${subscription.status}` : "ยังไม่มี subscription"}
          />
          <InfoCard
            Icon={IconDocument}
            title="LINE LIFF"
            main={line?.liff_id ?? "ยังไม่ได้เชื่อม LIFF"}
            detail={line?.basic_id ? `LINE OA ${line.basic_id}` : "ใช้สำหรับฟอร์มใน LINE"}
            ok={line?.is_active}
          />
          <InfoCard
            Icon={IconCheckin}
            title="เวลาทำงาน"
            main={`${settings.timezone} / ${settings.locale}`}
            detail={`ทำงาน ${form.workweek?.length ?? 0} วันต่อสัปดาห์`}
          />
          <InfoCard
            Icon={IconSettings}
            title="Theme เริ่มต้น"
            main={settings.theme}
            detail="ผู้ใช้ยังเปลี่ยน theme ของตัวเองได้ในโปรไฟล์"
          />
        </div>
      </div>
    </>
  );
}

function InfoCard({
  Icon, title, main, detail, ok,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  title: string;
  main: string;
  detail: string;
  ok?: boolean;
}) {
  return (
    <Card>
      <CardBody style={{ display: "flex", gap: "calc(var(--u)*3)", alignItems: "center" }}>
        <span className="stat-soft" style={{ "--stat-c": ok ? "var(--success)" : "var(--primary)", width: 48, height: 48, padding: 0, display: "grid", placeItems: "center", flex: "0 0 auto" } as React.CSSProperties}>
          <span className="ic"><Icon className="" /></span>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: ".8em", color: "var(--text-faint)", fontWeight: 600 }}>{title}</div>
          <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{main}</div>
          <div style={{ fontSize: ".82em", color: "var(--text-muted)" }}>{detail}</div>
        </div>
      </CardBody>
    </Card>
  );
}
