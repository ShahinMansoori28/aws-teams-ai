import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { bffPost, fail } from "@/lib/server/bff";
import { getAccount, startTotp } from "@/lib/server/cognito";
import { ACCESS_COOKIE } from "@/lib/server/cookies";

/**
 * POST {} → a new authenticator secret, as text and as a QR code to scan.
 * otpauth:// is the standard URI every authenticator app (Google, Microsoft, 1Password) understands.
 */
export const POST = bffPost(async (req) => {
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!at) return fail(401, "Your session expired. Reload the page.");
  const [secret, account] = await Promise.all([startTotp(at), getAccount(at)]);
  const label = encodeURIComponent(`Teams AI:${account.email}`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Teams AI")}`;
  const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 192 });
  return NextResponse.json({ secret, qrSvg });
});
