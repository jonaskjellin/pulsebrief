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

  // Send individually so recipients don't see each other
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
  // Style the content for email — inline styles required for email clients
  const styledBody = bodyHtml
    .replace(/<a /g, '<a style="color: #1a73e8; text-decoration: none; border-bottom: 1px solid #c5d9f0;" ')
    .replace(/<h1>(.*?)<\/h1>/g, '<h1 style="margin: 0 0 4px; font-size: 28px; font-weight: 300; color: #1a1a1a; letter-spacing: -0.5px;">$1</h1>')
    .replace(/<h2>(.*?)<\/h2>/g, '<tr><td style="padding: 28px 48px 12px;"><h2 style="margin: 0; font-size: 11px; font-weight: 700; color: #1a73e8; text-transform: uppercase; letter-spacing: 1.5px;">$1</h2></td></tr><tr><td style="padding: 0 48px 16px;">')
    .replace(/<h3>(.*?)<\/h3>/g, '<h3 style="margin: 18px 0 2px; font-size: 16px; font-weight: 600; color: #1a1a1a; line-height: 1.4;">$1</h3>')
    .replace(/<em>(.*?)<\/em>/g, '<span style="font-style: italic; color: #5f6368;">$1</span>')
    .replace(/<blockquote>(.*?)<\/blockquote>/g, '<div style="border-left: 2px solid #1a73e8; padding-left: 14px; margin: 6px 0 14px; color: #5f6368; font-size: 13px; line-height: 1.5;">$1</div>')
    .replace(/<hr>/g, '')
    .replace(/<p>/g, '<p style="margin: 0 0 10px; font-size: 14px; line-height: 1.7; color: #3c4043;">');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8f9fa;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="background-color: #ffffff; max-width: 720px; width: 100%; border: 1px solid #e8eaed; border-radius: 4px;">
          <tr>
            <td style="padding: 40px 48px 20px;">
              ${styledBody}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 48px 24px; border-top: 1px solid #e8eaed;">
              <p style="margin: 0; font-size: 11px; color: #9aa0a6; text-align: center;">
                PulseBrief — Personal intelligence briefing
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
