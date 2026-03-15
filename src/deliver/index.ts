import type { DeliveryChannel } from "../config/schema";
import type { BriefItem } from "../ai";
import { renderMarkdown, renderHtml } from "./render";
import { deliverToFile } from "./file";
import { deliverByEmail } from "./email";

export async function deliverBrief(
  items: BriefItem[],
  channels: DeliveryChannel[],
  preset?: string
): Promise<{ markdown: string; html: string }> {
  const markdown = renderMarkdown(items);
  const html = renderHtml(markdown);

  const date = new Date().toISOString().split("T")[0];
  const subject = `PulseBrief — ${date}`;

  for (const channel of channels) {
    try {
      switch (channel.type) {
        case "file":
          deliverToFile(markdown, channel.path, preset);
          break;
        case "email":
          await deliverByEmail(html, subject, channel);
          break;
      }
    } catch (err) {
      console.error(`[deliver] Error delivering to ${channel.type}:`, (err as Error).message);
    }
  }

  return { markdown, html };
}
