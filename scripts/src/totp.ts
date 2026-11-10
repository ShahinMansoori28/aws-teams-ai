import { createHmac } from "node:crypto";

/**
 * TOTP (RFC 6238), the thing your authenticator app does: HMAC-SHA1(secret, current 30-second step),
 * then cut the result down to 6 digits. Only used by tests here, so the smoke test can pass MFA
 * without a phone. Shows there's no magic: secret + clock = code.
 */
export function totp(base32Secret: string, now = Date.now(), step = 30, digits = 6): string {
  const counter = Math.floor(now / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", base32Decode(base32Secret)).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f; // "dynamic truncation" from RFC 4226
  const bin = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/** Authenticator secrets are base32 (A-Z, 2-7), so they're easy to type by hand. */
export function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of s.replace(/=+$/, "").toUpperCase().replace(/\s/g, "")) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error(`not base32: ${ch}`);
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
