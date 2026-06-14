/**
 * Email delivery via Resend.
 * Zero sensitive financial data in any email.
 * Only: friendly message + secure verification link.
 */

export interface SendVerifyEmailParams {
  to:        string;   /* debtor's email address */
  invoiceId: number;
  token:     string;   /* raw 32-byte token */
  supplierName?: string; /* optional — displayed as "from" context */
  expiresHours?: number; /* default 72 */
  invoiceNumber?: string; /* optional override, defaults to "INV-{invoiceId}" */
}

export async function sendVerifyEmail(
  params: SendVerifyEmailParams,
  resendApiKey: string
): Promise<{ id: string }> {
  const {
    to, invoiceId, token,
    supplierName = "a supplier",
    expiresHours = 72,
    invoiceNumber,
  } = params;

  const invRef = invoiceNumber ?? `INV-${invoiceId}`;
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://arbitra-dapp.vercel.app"}/verify/${invoiceId}?token=${token}`;

  const html = buildEmailHtml({ link, supplierName, expiresHours, invoiceId, invoiceNumber: invRef });
  const text = buildEmailText({ link, supplierName, expiresHours, invoiceNumber: invRef });

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    "Arbitra Verification <verify@arbitra.finance>",
      to:      [to],
      subject: `Payment Redirection and Notice of Assignment: ${invRef}`,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }

  return res.json();
}

/* ── Email templates ── */

function buildEmailHtml(p: {
  link: string; supplierName: string; expiresHours: number;
  invoiceId?: number; invoiceNumber?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice Verification — Arbitra</title>
</head>
<body style="margin:0;padding:0;background:#060B18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060B18;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#0A1026;border:1px solid rgba(0,240,255,0.15);border-radius:16px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#060B18 0%,#0D1535 100%);padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#00F0FF,#7B2FFF);border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                  <span style="color:#060B18;font-weight:800;font-size:18px;line-height:36px;">A</span>
                </td>
                <td style="padding-left:12px;">
                  <p style="margin:0;color:#EEF2FF;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Arbitra</p>
                  <p style="margin:0;color:#3D4E7A;font-size:11px;font-weight:500;letter-spacing:0.05em;">CONFIDENTIAL INVOICE FACTORING</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;color:#3D4E7A;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;">
              Action Required — Payment Redirection Notice
            </p>
            <h1 style="margin:0 0 16px;color:#EEF2FF;font-size:22px;font-weight:800;line-height:1.2;letter-spacing:-0.02em;">
              Notice of Assignment: ${p.invoiceNumber ?? `Invoice #${p.invoiceId}`}
            </h1>
            <p style="margin:0 0 28px;color:#8B9CC8;font-size:15px;line-height:1.7;">
              ${p.supplierName} has legally assigned the above invoice to the Arbitra
              Factoring SPV through a regulated trade finance platform. You are required
              to confirm receipt of this notice and direct all future payments accordingly.
            </p>
            <p style="margin:0 0 28px;color:#8B9CC8;font-size:15px;line-height:1.7;">
              No financial data is included in this email. All invoice details are
              encrypted and can only be viewed through the secure link below.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#00F0FF;border-radius:12px;">
                  <a href="${p.link}"
                    style="display:inline-block;padding:14px 32px;color:#060B18;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:-0.01em;">
                    Review &amp; Verify Invoice →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Expiry notice -->
            <div style="background:rgba(255,186,0,0.06);border:1px solid rgba(255,186,0,0.18);border-radius:10px;padding:14px 16px;margin-bottom:28px;">
              <p style="margin:0;color:#FFBA00;font-size:13px;font-weight:600;">
                ⚠ This link expires in ${p.expiresHours} hours
              </p>
              <p style="margin:4px 0 0;color:#8B9CC8;font-size:12px;line-height:1.5;">
                If you do not complete verification before expiry, the supplier will
                need to request a new link.
              </p>
            </div>

            <!-- If button doesn't work -->
            <p style="margin:0 0 6px;color:#3D4E7A;font-size:12px;font-weight:600;">
              If the button doesn't work, copy this link into your browser:
            </p>
            <p style="margin:0;color:#00F0FF;font-size:11px;word-break:break-all;font-family:monospace;">
              ${p.link}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;color:#3D4E7A;font-size:11px;line-height:1.65;text-align:center;">
              Arbitra is a decentralized trade finance platform powered by Zama FHEVM.<br>
              Your financial data is protected by Fully Homomorphic Encryption.<br>
              <strong style="color:#8B9CC8;">This email contains zero sensitive financial information.</strong><br><br>
              If you did not expect this email, you can safely ignore it.
              The link will expire automatically in ${p.expiresHours} hours.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

function buildEmailText(p: {
  link: string; supplierName: string; expiresHours: number;
  invoiceNumber?: string;
}): string {
  return `
ARBITRA — Payment Redirection and Notice of Assignment: ${p.invoiceNumber ?? "Invoice"}
═══════════════════════════════════════════════════════════════════════════

${p.supplierName} has legally assigned the above invoice to the Arbitra
Factoring SPV. You are required to acknowledge receipt of this Notice of
Assignment (NOA) and redirect all future payments to the SPV.

IMPORTANT: No financial data is included in this email. All invoice details
are encrypted and can only be viewed through the secure verification portal.

Review and acknowledge the Notice of Assignment here:
${p.link}

This link expires in ${p.expiresHours} hours.

Once acknowledged, payment obligations under this invoice are owed
exclusively to the Arbitra Factoring SPV — not the original supplier.

If you did not expect this email, you can safely ignore it.

— The Arbitra Legal & Compliance Team
arbitra-dapp.vercel.app
  `.trim();
}
