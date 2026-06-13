const API = "https://api.line.me/v2/bot";

export type LineMessage = { type: "text"; text: string } | Record<string, unknown>;

/** Reply to a LINE event (replyToken is single-use, valid ~30s). */
export async function replyMessage(accessToken: string, replyToken: string, messages: LineMessage[]) {
  const res = await fetch(`${API}/message/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) console.error("LINE reply failed", res.status, await res.text());
  return res.ok;
}

/** Push a message to a user (no replyToken needed). */
export async function pushMessage(accessToken: string, to: string, messages: LineMessage[]) {
  const res = await fetch(`${API}/message/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) console.error("LINE push failed", res.status, await res.text());
  return res.ok;
}

export const textMsg = (text: string): LineMessage => ({ type: "text", text });

/** Show the animated "…" loading indicator in a 1:1 chat (5–60s, multiple of 5). */
export async function startLoading(accessToken: string, chatId: string, seconds = 10) {
  const loadingSeconds = Math.min(60, Math.max(5, Math.round(seconds / 5) * 5));
  try {
    await fetch(`${API}/chat/loading/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ chatId, loadingSeconds }),
    });
  } catch { /* best-effort — never block the reply */ }
}
