// Flex Message builders — premium LINE OA cards on the HR brand palette.
// Brand: blue #3c8cf3 · green #05be8a · purple #745af2 · amber #e8920c · red #ef5350
import type { LineMessage } from "./client";

const INK = "#1f2733";
const MUTED = "#6b7480";
const FAINT = "#9aa1ab";
const BORDER = "#eceef3";
const PRIMARY = "#3c8cf3";

type StatusStyle = { label: string; fg: string; bg: string };
const STATUS: Record<string, StatusStyle> = {
  pending: { label: "รออนุมัติ", fg: "#b06f00", bg: "#fdf1dd" },
  approved: { label: "อนุมัติแล้ว", fg: "#067a59", bg: "#e1f7f1" },
  rejected: { label: "ไม่อนุมัติ", fg: "#c0322f", bg: "#fdeceb" },
  cancelled: { label: "ยกเลิก", fg: "#5b6470", bg: "#eef0f5" },
  completed: { label: "เสร็จสิ้น", fg: "#2f7ce0", bg: "#e8f1fe" },
  draft: { label: "ร่าง", fg: "#5b6470", bg: "#eef0f5" },
  failed: { label: "ล้มเหลว", fg: "#c0322f", bg: "#fdeceb" },
};
const statusOf = (s: string) => STATUS[s] ?? STATUS.pending;

/* ---------- shared atoms ---------- */

// a label → value row
function row(label: string, value: string, opts: { strong?: boolean } = {}) {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: MUTED, flex: 2, gravity: "center" },
      {
        type: "text",
        text: value,
        size: "sm",
        color: INK,
        weight: opts.strong ? "bold" : "regular",
        align: "end",
        gravity: "center",
        flex: 3,
        wrap: true,
      },
    ],
  };
}

// a coloured status pill, right-aligned within a labelled row
function statusRow(status: string) {
  const s = statusOf(status);
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: "สถานะ", size: "sm", color: MUTED, gravity: "center", flex: 1 },
      {
        type: "box",
        layout: "vertical",
        flex: 0,
        backgroundColor: s.bg,
        cornerRadius: "20px",
        paddingAll: "5px",
        paddingStart: "12px",
        paddingEnd: "12px",
        contents: [{ type: "text", text: s.label, size: "xs", weight: "bold", color: s.fg, align: "center" }],
      },
    ],
  };
}

function pill(text: string, fg: string, bg: string) {
  return {
    type: "box",
    layout: "vertical",
    flex: 0,
    backgroundColor: bg,
    cornerRadius: "20px",
    paddingAll: "4px",
    paddingStart: "10px",
    paddingEnd: "10px",
    contents: [{ type: "text", text, size: "xxs", weight: "bold", color: fg, align: "center" }],
  };
}

function bubble(body: object, opts: { footer?: object; size?: string } = {}) {
  const b: Record<string, unknown> = { type: "bubble", size: opts.size ?? "kilo", body };
  if (opts.footer) b.footer = opts.footer;
  return b;
}

function flex(altText: string, contents: object): LineMessage {
  return { type: "flex", altText, contents } as LineMessage;
}

/* ---------- public cards ---------- */

/** Leave-request receipt (sent after a successful LIFF submit). */
export function leaveReceiptFlex(p: {
  requestNo: string;
  typeName: string;
  range: string;
  days: number | string;
  status?: string;
}): LineMessage {
  const status = p.status ?? "pending";
  const body = {
    type: "box",
    layout: "vertical",
    paddingAll: "0px",
    contents: [
      // header band
      {
        type: "box",
        layout: "horizontal",
        backgroundColor: "#05be8a",
        paddingAll: "18px",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "vertical",
            flex: 0,
            width: "34px",
            height: "34px",
            backgroundColor: "#ffffff33",
            cornerRadius: "10px",
            justifyContent: "center",
            contents: [{ type: "text", text: "✓", size: "lg", color: "#ffffff", align: "center", weight: "bold" }],
          },
          {
            type: "box",
            layout: "vertical",
            justifyContent: "center",
            contents: [
              { type: "text", text: "ส่งคำขอลาแล้ว", color: "#ffffff", weight: "bold", size: "lg" },
              { type: "text", text: "ส่งให้หัวหน้าอนุมัติเรียบร้อย", color: "#eafff7", size: "xs" },
            ],
          },
        ],
      },
      // detail rows
      {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        spacing: "md",
        contents: [
          row("ประเภท", p.typeName, { strong: true }),
          row("วันที่", p.range),
          row("จำนวน", `${p.days} วันทำงาน`),
          { type: "separator", color: BORDER },
          row("เลขที่คำขอ", p.requestNo),
          statusRow(status),
        ],
      },
    ],
  };
  return flex(`ส่งคำขอลาแล้ว ${p.requestNo}`, bubble(body, { size: "mega" }));
}

/** List of the employee's recent requests (status query) — leave or OT. */
export function statusListFlex(name: string, items: Array<{
  title: string; sub: string; status: string; requestNo: string;
}>): LineMessage {
  const rows = items.flatMap((it, i) => {
    const s = statusOf(it.status);
    const block = {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      paddingTop: i === 0 ? "0px" : "10px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: it.title, size: "sm", weight: "bold", color: INK, gravity: "center", flex: 1, wrap: true },
            pill(s.label, s.fg, s.bg),
          ],
        },
        { type: "text", text: it.sub, size: "xs", color: MUTED },
        { type: "text", text: it.requestNo, size: "xxs", color: FAINT },
      ],
    };
    return i === 0 ? [block] : [{ type: "separator", color: BORDER }, block];
  });

  const body = {
    type: "box",
    layout: "vertical",
    paddingAll: "0px",
    contents: [
      {
        type: "box",
        layout: "vertical",
        backgroundColor: PRIMARY,
        paddingAll: "18px",
        contents: [
          { type: "text", text: "คำขอล่าสุดของคุณ", color: "#ffffff", weight: "bold", size: "lg" },
          { type: "text", text: name, color: "#e8f1fe", size: "xs" },
        ],
      },
      { type: "box", layout: "vertical", paddingAll: "18px", spacing: "none", contents: rows },
    ],
  };
  return flex("คำขอล่าสุดของคุณ", bubble(body, { size: "mega" }));
}

/** Generic info card with a coloured header + optional CTA button. */
export function infoFlex(p: {
  color: string; emoji: string; title: string; text: string;
  altText?: string; button?: { label: string; uri: string };
}): LineMessage {
  const body = {
    type: "box",
    layout: "vertical",
    paddingAll: "20px",
    spacing: "sm",
    contents: [
      {
        type: "box",
        layout: "vertical",
        flex: 0,
        width: "46px",
        height: "46px",
        backgroundColor: p.color,
        cornerRadius: "14px",
        justifyContent: "center",
        contents: [{ type: "text", text: p.emoji, size: "xl", align: "center" }],
      },
      { type: "text", text: p.title, weight: "bold", size: "lg", color: INK, margin: "md" },
      { type: "text", text: p.text, size: "sm", color: MUTED, wrap: true },
    ],
  };
  const footer = p.button
    ? {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        paddingTop: "0px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: p.color,
            height: "sm",
            action: { type: "uri", label: p.button.label, uri: p.button.uri },
          },
        ],
      }
    : undefined;
  return flex(p.altText ?? p.title, bubble(body, { footer }));
}

export function comingSoonFlex(feature: string, emoji: string): LineMessage {
  return infoFlex({
    color: "#745af2", emoji, title: feature,
    text: "ฟีเจอร์นี้กำลังจะเปิดให้บริการเร็วๆ นี้ ขอบคุณที่รอนะคะ 🙏",
    altText: `${feature} — เร็วๆ นี้`,
  });
}

export function contactFlex(): LineMessage {
  const body = {
    type: "box",
    layout: "vertical",
    paddingAll: "20px",
    spacing: "sm",
    contents: [
      {
        type: "box", layout: "vertical", flex: 0, width: "46px", height: "46px",
        backgroundColor: "#f2647a", cornerRadius: "14px", justifyContent: "center",
        contents: [{ type: "text", text: "🎧", size: "xl", align: "center" }],
      },
      { type: "text", text: "ติดต่อฝ่ายบุคคล", weight: "bold", size: "lg", color: INK, margin: "md" },
      { type: "separator", color: BORDER, margin: "md" },
      row("อีเมล", "hr@demo.co"),
      row("โทรศัพท์", "ต่อ 100"),
      row("เวลาทำการ", "จ–ศ 9:00–18:00"),
    ],
  };
  return flex("ติดต่อฝ่ายบุคคล (HR)", bubble(body));
}

/** Approval request sent to an approver (manager/HR) with action buttons. */
export function approvalRequestFlex(p: {
  requestId: string; employeeName: string; typeName: string;
  range: string; days: number | string; reason?: string | null; requestNo: string;
}): LineMessage {
  const detail = [
    row("พนักงาน", p.employeeName, { strong: true }),
    row("ประเภท", p.typeName),
    row("วันที่", p.range),
    row("จำนวน", `${p.days} วันทำงาน`),
    ...(p.reason ? [row("เหตุผล", p.reason)] : []),
    { type: "separator", color: BORDER },
    row("เลขที่", p.requestNo),
  ];
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: "#e8920c", paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: "📋", size: "lg", align: "center" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: "คำขอลารออนุมัติ", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: "กรุณาพิจารณาคำขอด้านล่าง", color: "#fff4e0", size: "xs" },
          ] },
        ],
      },
      { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: detail },
    ],
  };
  const footer = {
    type: "box", layout: "horizontal", spacing: "sm", paddingAll: "16px", paddingTop: "0px",
    contents: [
      { type: "button", style: "secondary", height: "sm", action: { type: "postback", label: "ปฏิเสธ", data: `reject:${p.requestId}`, displayText: "❌ ปฏิเสธคำขอลา" } },
      { type: "button", style: "primary", color: "#05be8a", height: "sm", action: { type: "postback", label: "อนุมัติ", data: `approve:${p.requestId}`, displayText: "✅ อนุมัติคำขอลา" } },
    ],
  };
  return flex(`คำขอลารออนุมัติ — ${p.employeeName}`, bubble(body, { footer, size: "mega" }));
}

/** Approval result sent to the employee. */
export function approvalResultFlex(p: {
  approved: boolean; typeName: string; range: string; days: number | string;
  requestNo: string; reason?: string | null; byName?: string | null;
}): LineMessage {
  const color = p.approved ? "#05be8a" : "#ef5350";
  const detail = [
    row("ประเภท", p.typeName),
    row("วันที่", p.range),
    row("จำนวน", `${p.days} วันทำงาน`),
    ...(p.byName ? [row(p.approved ? "ผู้อนุมัติ" : "ผู้พิจารณา", p.byName)] : []),
    ...(!p.approved && p.reason ? [row("เหตุผล", p.reason)] : []),
    { type: "separator", color: BORDER },
    row("เลขที่", p.requestNo),
  ];
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: color, paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: p.approved ? "✓" : "✕", size: "lg", color: "#ffffff", align: "center", weight: "bold" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: p.approved ? "คำขอลาได้รับอนุมัติ" : "คำขอลาถูกปฏิเสธ", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: p.approved ? "ลาของคุณได้รับการอนุมัติแล้ว 🎉" : "โปรดติดต่อหัวหน้า/HR หากมีข้อสงสัย", color: "#ffffff", size: "xs" },
          ] },
        ],
      },
      { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: detail },
    ],
  };
  return flex(p.approved ? "คำขอลาได้รับอนุมัติ" : "คำขอลาถูกปฏิเสธ", bubble(body, { size: "mega" }));
}

/* ---------- OT cards ---------- */

function otDetailRows(p: { dateText: string; timeRange: string; hours: number | string; rateLabel: string; reason?: string | null; requestNo: string }) {
  return [
    row("วันที่", p.dateText),
    row("เวลา", p.timeRange),
    row("รวมชั่วโมง", `${p.hours} ชม.`, { strong: true }),
    row("อัตรา", p.rateLabel),
    ...(p.reason ? [row("เหตุผล", p.reason)] : []),
    { type: "separator", color: BORDER },
    row("เลขที่คำขอ", p.requestNo),
  ];
}

/** OT-request receipt (sent after a successful LIFF submit). */
export function otReceiptFlex(p: {
  requestNo: string; dateText: string; timeRange: string; hours: number | string; rateLabel: string; status?: string;
}): LineMessage {
  const status = p.status ?? "pending";
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: "#05be8a", paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: "✓", size: "lg", color: "#ffffff", align: "center", weight: "bold" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: "ส่งคำขอ OT แล้ว", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: "ส่งให้หัวหน้าอนุมัติเรียบร้อย", color: "#eafff7", size: "xs" },
          ] },
        ],
      },
      {
        type: "box", layout: "vertical", paddingAll: "18px", spacing: "md",
        contents: [
          row("วันที่", p.dateText),
          row("เวลา", p.timeRange),
          row("รวมชั่วโมง", `${p.hours} ชม.`, { strong: true }),
          row("อัตรา", p.rateLabel),
          { type: "separator", color: BORDER },
          row("เลขที่คำขอ", p.requestNo),
          statusRow(status),
        ],
      },
    ],
  };
  return flex(`ส่งคำขอ OT แล้ว ${p.requestNo}`, bubble(body, { size: "mega" }));
}

/** OT approval request sent to an approver with action buttons. */
export function otApprovalRequestFlex(p: {
  requestId: string; employeeName: string; dateText: string; timeRange: string;
  hours: number | string; rateLabel: string; reason?: string | null; requestNo: string;
}): LineMessage {
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: "#e8920c", paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: "⏱️", size: "lg", align: "center" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: "คำขอ OT รออนุมัติ", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: "กรุณาพิจารณาคำขอด้านล่าง", color: "#fff4e0", size: "xs" },
          ] },
        ],
      },
      {
        type: "box", layout: "vertical", paddingAll: "18px", spacing: "md",
        contents: [row("พนักงาน", p.employeeName, { strong: true }), ...otDetailRows(p)],
      },
    ],
  };
  const footer = {
    type: "box", layout: "horizontal", spacing: "sm", paddingAll: "16px", paddingTop: "0px",
    contents: [
      { type: "button", style: "secondary", height: "sm", action: { type: "postback", label: "ปฏิเสธ", data: `otreject:${p.requestId}`, displayText: "❌ ปฏิเสธคำขอ OT" } },
      { type: "button", style: "primary", color: "#05be8a", height: "sm", action: { type: "postback", label: "อนุมัติ", data: `otapprove:${p.requestId}`, displayText: "✅ อนุมัติคำขอ OT" } },
    ],
  };
  return flex(`คำขอ OT รออนุมัติ — ${p.employeeName}`, bubble(body, { footer, size: "mega" }));
}

/** OT approval result sent to the employee. */
export function otApprovalResultFlex(p: {
  approved: boolean; dateText: string; timeRange: string; hours: number | string;
  rateLabel: string; requestNo: string; reason?: string | null; byName?: string | null;
}): LineMessage {
  const color = p.approved ? "#05be8a" : "#ef5350";
  const detail = [
    row("วันที่", p.dateText),
    row("เวลา", p.timeRange),
    row("รวมชั่วโมง", `${p.hours} ชม.`, { strong: true }),
    row("อัตรา", p.rateLabel),
    ...(p.byName ? [row(p.approved ? "ผู้อนุมัติ" : "ผู้พิจารณา", p.byName)] : []),
    ...(!p.approved && p.reason ? [row("เหตุผล", p.reason)] : []),
    { type: "separator", color: BORDER },
    row("เลขที่", p.requestNo),
  ];
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: color, paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: p.approved ? "✓" : "✕", size: "lg", color: "#ffffff", align: "center", weight: "bold" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: p.approved ? "คำขอ OT ได้รับอนุมัติ" : "คำขอ OT ถูกปฏิเสธ", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: p.approved ? "OT ของคุณได้รับการอนุมัติแล้ว 🎉" : "โปรดติดต่อหัวหน้า/HR หากมีข้อสงสัย", color: "#ffffff", size: "xs" },
          ] },
        ],
      },
      { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: detail },
    ],
  };
  return flex(p.approved ? "คำขอ OT ได้รับอนุมัติ" : "คำขอ OT ถูกปฏิเสธ", bubble(body, { size: "mega" }));
}

/* ---------- Document cards ---------- */

/** Document-request receipt (sent after a successful LIFF submit). */
export function docReceiptFlex(p: {
  requestNo: string; typeName: string; language: string; purpose?: string | null; status?: string;
}): LineMessage {
  const status = p.status ?? "pending";
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: "#05be8a", paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: "✓", size: "lg", color: "#ffffff", align: "center", weight: "bold" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: "ส่งคำขอเอกสารแล้ว", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: "ส่งให้ฝ่ายบุคคลดำเนินการเรียบร้อย", color: "#eafff7", size: "xs" },
          ] },
        ],
      },
      {
        type: "box", layout: "vertical", paddingAll: "18px", spacing: "md",
        contents: [
          row("ประเภท", p.typeName, { strong: true }),
          row("ภาษา", p.language),
          ...(p.purpose ? [row("วัตถุประสงค์", p.purpose)] : []),
          { type: "separator", color: BORDER },
          row("เลขที่คำขอ", p.requestNo),
          statusRow(status),
        ],
      },
    ],
  };
  return flex(`ส่งคำขอเอกสารแล้ว ${p.requestNo}`, bubble(body, { size: "mega" }));
}

/** Document approval request sent to an approver (HR) with action buttons. */
export function docApprovalRequestFlex(p: {
  requestId: string; employeeName: string; typeName: string; language: string;
  purpose?: string | null; requestNo: string;
}): LineMessage {
  const detail = [
    row("พนักงาน", p.employeeName, { strong: true }),
    row("ประเภท", p.typeName),
    row("ภาษา", p.language),
    ...(p.purpose ? [row("วัตถุประสงค์", p.purpose)] : []),
    { type: "separator", color: BORDER },
    row("เลขที่", p.requestNo),
  ];
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: "#e8920c", paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: "📄", size: "lg", align: "center" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: "คำขอเอกสารรออนุมัติ", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: "กรุณาพิจารณาคำขอด้านล่าง", color: "#fff4e0", size: "xs" },
          ] },
        ],
      },
      { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: detail },
    ],
  };
  const footer = {
    type: "box", layout: "horizontal", spacing: "sm", paddingAll: "16px", paddingTop: "0px",
    contents: [
      { type: "button", style: "secondary", height: "sm", action: { type: "postback", label: "ปฏิเสธ", data: `docreject:${p.requestId}`, displayText: "❌ ปฏิเสธคำขอเอกสาร" } },
      { type: "button", style: "primary", color: "#05be8a", height: "sm", action: { type: "postback", label: "อนุมัติ", data: `docapprove:${p.requestId}`, displayText: "✅ อนุมัติคำขอเอกสาร" } },
    ],
  };
  return flex(`คำขอเอกสารรออนุมัติ — ${p.employeeName}`, bubble(body, { footer, size: "mega" }));
}

/** Document approval result sent to the employee. */
export function docApprovalResultFlex(p: {
  approved: boolean; typeName: string; language: string; requestNo: string;
  reason?: string | null; byName?: string | null;
}): LineMessage {
  const color = p.approved ? "#05be8a" : "#ef5350";
  const detail = [
    row("ประเภท", p.typeName),
    row("ภาษา", p.language),
    ...(p.byName ? [row(p.approved ? "ผู้อนุมัติ" : "ผู้พิจารณา", p.byName)] : []),
    ...(!p.approved && p.reason ? [row("เหตุผล", p.reason)] : []),
    { type: "separator", color: BORDER },
    row("เลขที่", p.requestNo),
  ];
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: color, paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: p.approved ? "✓" : "✕", size: "lg", color: "#ffffff", align: "center", weight: "bold" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: p.approved ? "คำขอเอกสารได้รับอนุมัติ" : "คำขอเอกสารถูกปฏิเสธ", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: p.approved ? "ฝ่ายบุคคลกำลังจัดทำเอกสารให้ 📄" : "โปรดติดต่อ HR หากมีข้อสงสัย", color: "#ffffff", size: "xs" },
          ] },
        ],
      },
      { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: detail },
    ],
  };
  return flex(p.approved ? "คำขอเอกสารได้รับอนุมัติ" : "คำขอเอกสารถูกปฏิเสธ", bubble(body, { size: "mega" }));
}

/* ---------- in-chat quick forms (datetime pickers) ---------- */

function pickerBtn(label: string, data: string, mode: "date" | "time", initial?: string) {
  return {
    type: "button", style: "secondary", height: "sm", margin: "sm",
    action: { type: "datetimepicker", label, data, mode, ...(initial ? { initial } : {}) },
  };
}
function postBtn(label: string, data: string, opts: { style?: string; color?: string } = {}) {
  return {
    type: "button", height: "sm", margin: "sm", style: opts.style ?? "secondary", ...(opts.color ? { color: opts.color } : {}),
    action: { type: "postback", label, data, displayText: label },
  };
}

/** In-chat OT form — pick date/time and submit without opening LIFF. */
export function chatOtFlex(p: {
  date: string; start: string; end: string; note: string | null;
  hours: number | string; rateLabel: string; fullUri?: string;
}): LineMessage {
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: "#e8920c", paddingAll: "16px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "30px", height: "30px", backgroundColor: "#ffffff33", cornerRadius: "9px", justifyContent: "center", contents: [{ type: "text", text: "⏱️", size: "md", align: "center" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: "ขอทำ OT — กรอกในแชต", color: "#ffffff", weight: "bold", size: "md" },
            { type: "text", text: "แตะเพื่อเลือก แล้วกดส่ง", color: "#fff4e0", size: "xxs" },
          ] },
        ],
      },
      {
        type: "box", layout: "vertical", paddingAll: "14px", spacing: "none",
        contents: [
          pickerBtn(`📅 วันที่: ${p.date}`, "cf:date", "date", p.date),
          pickerBtn(`🕐 เริ่ม: ${p.start}`, "cf:start", "time", p.start),
          pickerBtn(`🕐 สิ้นสุด: ${p.end}`, "cf:end", "time", p.end),
          postBtn(`✏️ หมายเหตุ: ${p.note ? p.note.slice(0, 18) : "(ไม่มี)"}`, "cf:note"),
          { type: "separator", color: BORDER, margin: "lg" },
          { type: "text", text: `รวม ${p.hours} ชม. · ${p.rateLabel}`, size: "sm", color: MUTED, align: "center", margin: "md" },
        ],
      },
    ],
  };
  const footerBtns: object[] = [postBtn("✅ ส่งคำขอ OT", "cf:submit", { style: "primary", color: "#05be8a" })];
  if (p.fullUri) footerBtns.push({ type: "button", height: "sm", margin: "sm", style: "link", action: { type: "uri", label: "เปิดฟอร์มเต็ม", uri: p.fullUri } });
  footerBtns.push(postBtn("ยกเลิก", "cf:cancel", { style: "link" }));
  const footer = { type: "box", layout: "vertical", paddingAll: "14px", paddingTop: "0px", contents: footerBtns };
  return flex("ขอทำ OT — กรอกในแชต", bubble(body, { footer, size: "mega" }));
}

/** In-chat leave form — pick dates and submit without opening LIFF. */
export function chatLeaveFlex(p: {
  typeName: string; start: string; end: string; note: string | null;
  days: number | string; fullUri?: string;
}): LineMessage {
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: "#3c8cf3", paddingAll: "16px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "30px", height: "30px", backgroundColor: "#ffffff33", cornerRadius: "9px", justifyContent: "center", contents: [{ type: "text", text: "📝", size: "md", align: "center" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: "ขอลางาน — กรอกในแชต", color: "#ffffff", weight: "bold", size: "md" },
            { type: "text", text: `ประเภท: ${p.typeName}`, color: "#e8f1fe", size: "xxs" },
          ] },
        ],
      },
      {
        type: "box", layout: "vertical", paddingAll: "14px", spacing: "none",
        contents: [
          pickerBtn(`📅 ตั้งแต่: ${p.start}`, "cf:date", "date", p.start),
          pickerBtn(`📅 ถึง: ${p.end}`, "cf:end", "date", p.end),
          postBtn(`✏️ หมายเหตุ: ${p.note ? p.note.slice(0, 18) : "(ไม่มี)"}`, "cf:note"),
          { type: "separator", color: BORDER, margin: "lg" },
          { type: "text", text: `รวม ${p.days} วันทำงาน`, size: "sm", color: MUTED, align: "center", margin: "md" },
        ],
      },
    ],
  };
  const footerBtns: object[] = [postBtn("✅ ส่งคำขอลา", "cf:submit", { style: "primary", color: "#05be8a" })];
  if (p.fullUri) footerBtns.push({ type: "button", height: "sm", margin: "sm", style: "link", action: { type: "uri", label: "เปิดฟอร์มเต็ม (เปลี่ยนประเภท)", uri: p.fullUri } });
  footerBtns.push(postBtn("ยกเลิก", "cf:cancel", { style: "link" }));
  const footer = { type: "box", layout: "vertical", paddingAll: "14px", paddingTop: "0px", contents: footerBtns };
  return flex("ขอลางาน — กรอกในแชต", bubble(body, { footer, size: "mega" }));
}

/* ---------- Attendance card ---------- */

/** Check-in / check-out confirmation (sent after a LIFF clock action). */
export function attendanceReceiptFlex(p: {
  kind: "in" | "out"; timeText: string; dateText: string; workMode: string;
  late?: boolean; lateMinutes?: number; locationName?: string | null; workedText?: string | null;
}): LineMessage {
  const isIn = p.kind === "in";
  const color = isIn ? "#3c8cf3" : "#745af2";
  const detail = [
    row(isIn ? "เวลาเข้า" : "เวลาออก", p.timeText, { strong: true }),
    row("วันที่", p.dateText),
    row("รูปแบบ", p.workMode),
    ...(p.locationName ? [row("สถานที่", p.locationName)] : []),
    ...(p.workedText ? [row("รวมเวลางาน", p.workedText)] : []),
  ];
  const body = {
    type: "box", layout: "vertical", paddingAll: "0px",
    contents: [
      {
        type: "box", layout: "horizontal", backgroundColor: color, paddingAll: "18px", spacing: "md",
        contents: [
          { type: "box", layout: "vertical", flex: 0, width: "34px", height: "34px", backgroundColor: "#ffffff33", cornerRadius: "10px", justifyContent: "center", contents: [{ type: "text", text: isIn ? "🟢" : "🔵", size: "md", align: "center" }] },
          { type: "box", layout: "vertical", justifyContent: "center", contents: [
            { type: "text", text: isIn ? "ลงเวลาเข้างานแล้ว" : "ลงเวลาออกงานแล้ว", color: "#ffffff", weight: "bold", size: "lg" },
            { type: "text", text: isIn ? (p.late ? `เข้างานสาย ${p.lateMinutes ?? 0} นาที` : "ตรงเวลา ขอให้เป็นวันที่ดี 🙌") : "ขอบคุณสำหรับวันนี้ 🙌", color: "#ffffffcc", size: "xs" },
          ] },
        ],
      },
      { type: "box", layout: "vertical", paddingAll: "18px", spacing: "md", contents: detail },
    ],
  };
  return flex(isIn ? "ลงเวลาเข้างานแล้ว" : "ลงเวลาออกงานแล้ว", bubble(body, { size: "mega" }));
}

/** Welcome / linked-success card. */
export function welcomeFlex(p: { name: string; linked: boolean; leaveUri?: string }): LineMessage {
  return infoFlex({
    color: "#3c8cf3",
    emoji: p.linked ? "🎉" : "👋",
    title: p.linked ? `ผูกบัญชีสำเร็จ` : `สวัสดีคุณ${p.name}`,
    text: p.linked
      ? `ยินดีต้อนรับคุณ${p.name} เลือกบริการจากเมนูด้านล่าง หรือกดปุ่มเพื่อขอลางานได้เลย`
      : "เลือกบริการจากเมนูด้านล่างได้เลย",
    altText: p.linked ? "ผูกบัญชีสำเร็จ" : `สวัสดีคุณ${p.name}`,
    button: p.leaveUri ? { label: "ขอลางาน", uri: p.leaveUri } : undefined,
  });
}
