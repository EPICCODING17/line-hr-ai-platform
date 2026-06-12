import crypto from "node:crypto";

/** Verify LINE webhook X-Line-Signature (HMAC-SHA256 of the raw body, base64). */
export function verifyLineSignature(rawBody: string, signature: string | null, channelSecret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
