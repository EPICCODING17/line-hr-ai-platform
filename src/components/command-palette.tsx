"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { THEME_LABEL, type Theme } from "@/lib/theme";
import {
  IconDashboard, IconUsers, IconLeave, IconClock, IconCheckin, IconDocument,
  IconSettings, IconPlus, IconLogout, IconSun, IconMoon, IconMoonStars, IconSearch,
  IconBuilding, IconBadge,
} from "@/components/icons";

type Cmd = {
  id: string;
  group: string;
  label: string;
  keywords?: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  hint?: string;
  run: () => void;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (href: string) => { onClose(); router.push(href); };

  const commands: Cmd[] = useMemo(() => [
    { id: "overview", group: "เมนู", label: "ภาพรวม", keywords: "dashboard home หน้าหลัก", Icon: IconDashboard, run: () => go("/dashboard") },
    { id: "employees", group: "เมนู", label: "พนักงาน", keywords: "employee staff คน", Icon: IconUsers, run: () => go("/dashboard/employees") },
    { id: "departments", group: "เมนู", label: "แผนก", keywords: "department team", Icon: IconBuilding, run: () => go("/dashboard/departments") },
    { id: "positions", group: "เมนู", label: "ตำแหน่ง", keywords: "position job title", Icon: IconBadge, run: () => go("/dashboard/positions") },
    { id: "leave", group: "เมนู", label: "การลา", keywords: "leave ลาป่วย ลาพักร้อน", Icon: IconLeave, run: () => go("/dashboard/leave") },
    { id: "ot", group: "เมนู", label: "OT", keywords: "overtime ทำงานล่วงเวลา", Icon: IconClock, run: () => go("/dashboard/ot") },
    { id: "attendance", group: "เมนู", label: "ลงเวลา", keywords: "attendance checkin เช็คอิน", Icon: IconCheckin, run: () => go("/dashboard/attendance") },
    { id: "documents", group: "เมนู", label: "เอกสาร", keywords: "document หนังสือรับรอง", Icon: IconDocument, run: () => go("/dashboard/documents") },
    { id: "settings", group: "เมนู", label: "ตั้งค่า", keywords: "settings config company", Icon: IconSettings, run: () => go("/dashboard/settings/company") },
    { id: "settings-policies", group: "ตั้งค่า", label: "นโยบาย", keywords: "policy leave ot attendance document", Icon: IconSettings, run: () => go("/dashboard/settings/policies") },
    { id: "settings-holidays", group: "ตั้งค่า", label: "วันหยุด", keywords: "holiday calendar", Icon: IconLeave, run: () => go("/dashboard/settings/holidays") },
    { id: "add-emp", group: "การกระทำ", label: "เพิ่มพนักงาน", keywords: "new employee สร้าง", Icon: IconPlus, run: () => go("/dashboard/employees?new=1") },
    { id: "add-dept", group: "การกระทำ", label: "เพิ่มแผนก", keywords: "new department สร้าง", Icon: IconPlus, run: () => go("/dashboard/departments?new=1") },
    { id: "add-position", group: "การกระทำ", label: "เพิ่มตำแหน่ง", keywords: "new position สร้าง", Icon: IconPlus, run: () => go("/dashboard/positions?new=1") },
    { id: "add-holiday", group: "การกระทำ", label: "เพิ่มวันหยุด", keywords: "new holiday สร้าง", Icon: IconPlus, run: () => go("/dashboard/settings/holidays?new=1") },
    { id: "theme-light", group: "ธีม", label: `ธีม: ${THEME_LABEL.light}`, keywords: "theme light สว่าง", Icon: IconSun, run: () => { setTheme("light" as Theme); onClose(); } },
    { id: "theme-dark", group: "ธีม", label: `ธีม: ${THEME_LABEL.dark}`, keywords: "theme dark มืด", Icon: IconMoon, run: () => { setTheme("dark" as Theme); onClose(); } },
    { id: "theme-dark2", group: "ธีม", label: `ธีม: ${THEME_LABEL.dark2}`, keywords: "theme dark2 มืด2", Icon: IconMoonStars, run: () => { setTheme("dark2" as Theme); onClose(); } },
    { id: "logout", group: "การกระทำ", label: "ออกจากระบบ", keywords: "logout signout ออก", Icon: IconLogout, hint: "ออก", run: async () => { onClose(); await createClient().auth.signOut(); router.push("/login"); router.refresh(); } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => (c.label + " " + (c.keywords ?? "")).toLowerCase().includes(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => { setActive(0); }, [q]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.run(); }
  };

  // group order preserved by first appearance
  const groups: string[] = [];
  filtered.forEach((c) => { if (!groups.includes(c.group)) groups.push(c.group); });
  let idx = -1;

  return (
    <div className="cmdk-scrim" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ค้นหาคำสั่ง" onKeyDown={onKey}>
        <div className="cmdk-search">
          <IconSearch className="" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์เพื่อค้นหาเมนูหรือคำสั่ง…" />
          <span className="kbd">ESC</span>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {filtered.length === 0 && <div className="cmdk-empty">ไม่พบรายการที่ตรงกับ “{q}”</div>}
          {groups.map((g) => (
            <div key={g}>
              <div className="cmdk-group">{g}</div>
              {filtered.filter((c) => c.group === g).map((c) => {
                idx++;
                const i = idx;
                return (
                  <div
                    key={c.id}
                    className={`cmdk-item${i === active ? " on" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => c.run()}
                  >
                    <c.Icon className="" />
                    <span className="ci-t">{c.label}</span>
                    {c.hint && <span className="ci-k">{c.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><span className="kbd">↑↓</span> เลื่อน</span>
          <span><span className="kbd">↵</span> เลือก</span>
          <span><span className="kbd">ESC</span> ปิด</span>
        </div>
      </div>
    </div>
  );
}
