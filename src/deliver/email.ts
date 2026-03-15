import type { DeliveryChannel } from "../config/schema";

export async function deliverByEmail(
  html: string,
  subject: string,
  channel: DeliveryChannel & { type: "email" }
): Promise<void> {
  // Lazy-load nodemailer only when email delivery is configured
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch {
    throw new Error("nodemailer is not installed. Run: npm install nodemailer");
  }

  const user = process.env[channel.smtp_user_env];
  const pass = process.env[channel.smtp_pass_env];

  if (!user || !pass) {
    throw new Error(
      `Email delivery requires ${channel.smtp_user_env} and ${channel.smtp_pass_env} environment variables`
    );
  }

  const transporter = nodemailer.createTransport({
    host: channel.smtp_host,
    port: channel.smtp_port,
    secure: channel.smtp_port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: channel.from,
    to: channel.to,
    subject,
    html,
  });

  console.log(`[deliver] Email sent to ${channel.to}`);
}
