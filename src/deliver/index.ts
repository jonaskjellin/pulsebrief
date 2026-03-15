import type { DeliveryChannel } from "../config/schema";
import type { BriefItem } from "../ai";
import { renderMarkdown, renderHtml, type RenderOptions } from "./render";
import { deliverToFile } from "./file";
import { deliverByEmail } from "./email";
import { deliverByResend } from "./resend";

export async function deliverBrief(
  items: BriefItem[],
  channels: DeliveryChannel[],
  options: RenderOptions & { preset?: string }
): Promise<{ markdown: string; html: string }> {
  const markdown = renderMarkdown(items, options);
  const html = renderHtml(markdown);

  const name = options.readerName || "PulseBrief";
  const presetLabel = options.preset
    ? options.preset.charAt(0).toUpperCase() + options.preset.slice(1)
    : "Update";
  const date = new Date().toISOString().split("T")[0];
  const subject = `${name}'s ${presetLabel} Pulse — ${date}`;

  for (const channel of channels) {
    try {
      switch (channel.type) {
        case "file":
          deliverToFile(markdown, channel.path, options.preset);
          break;
        case "email":
          await deliverByEmail(html, subject, channel);
          break;
        case "resend":
          await deliverByResend(html, subject, channel.from, channel.to);
          break;
      }
    } catch (err) {
      console.error(`[deliver] Error delivering to ${channel.type}:`, (err as Error).message);
    }
  }

  return { markdown, html };
}
