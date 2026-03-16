export async function deliverByResend(
  html: string,
  subject: string,
  from: string,
  to: string[]
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }

  for (const recipient of to) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html: wrapEmailHtml(html),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[deliver] Resend error for ${recipient}: ${body}`);
    } else {
      console.log(`[deliver] Email sent to ${recipient}`);
    }
  }
}

function wrapEmailHtml(bodyHtml: string): string {
  const styledBody = bodyHtml
    .replace(/<a /g, '<a style="color: #1a1a1a; text-decoration: underline; text-decoration-color: #ccc; text-underline-offset: 2px;" ')
    .replace(/<h1>(.*?)<\/h1>/g, '<h1 style="margin: 0 0 4px; font-size: 26px; font-weight: 300; color: #1a1a1a; letter-spacing: -0.5px;">$1</h1>')
    .replace(/<h2>(.*?)<\/h2>/g, '<tr><td style="padding: 32px 48px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding-bottom: 12px; border-bottom: 1px solid #e0e0e0;"><h2 style="margin: 0; font-size: 13px; font-weight: 600; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px;">$1</h2></td></tr></table></td></tr><tr><td style="padding: 0 48px 16px;">')
    .replace(/<h3>(.*?)<\/h3>/g, '<h3 style="margin: 18px 0 2px; font-size: 15px; font-weight: 600; color: #1a1a1a; line-height: 1.4;">$1</h3>')
    .replace(/<em>(.*?)<\/em>/g, '<span style="font-style: italic; color: #666;">$1</span>')
    .replace(/<blockquote>(.*?)<\/blockquote>/g, '<div style="border-left: 2px solid #d0d0d0; padding-left: 14px; margin: 6px 0 14px; color: #666; font-size: 13px; line-height: 1.5;">$1</div>')
    .replace(/<hr>/g, '')
    .replace(/<p>/g, '<p style="margin: 0 0 10px; font-size: 14px; line-height: 1.7; color: #333;">');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="background-color: #ffffff; max-width: 720px; width: 100%;">
          <tr>
            <td style="padding: 40px 48px 20px;">
              ${styledBody}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 48px 24px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 11px; color: #aaa; text-align: center;">
                PulseBrief
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
