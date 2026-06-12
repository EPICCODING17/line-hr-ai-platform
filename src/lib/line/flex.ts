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

/** List of the employee's recent leave requests (status query). */
export function statusListFlex(name: string, items: Array<{
  typeName: string; range: string; days: number | string; status: string; requestNo: string;
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
            { type: "text", text: it.typeName, size: "sm", weight: "bold", color: INK, gravity: "center", flex: 1, wrap: true },
            pill(s.label, s.fg, s.bg),
          ],
        },
        { type: "text", text: `${it.range} · ${it.days} วัน`, size: "xs", color: MUTED },
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
