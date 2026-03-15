import { SECTIONS, SECTION_LABELS, type BriefItem } from "../ai";

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatItemDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function renderItem(item: BriefItem): string {
  const lines: string[] = [];
  // Link the title to the primary source for easy click-through
  const primaryUrl = item.sources[0]?.url;
  if (primaryUrl) {
    lines.push(`### [${item.title}](${primaryUrl})`);
  } else {
    lines.push(`### ${item.title}`);
  }
  lines.push(`*${formatItemDate(item.date)}*\n`);
  lines.push(item.body + "\n");
  lines.push(`> *${item.why}*\n`);
  lines.push(
    `Sources: ${item.sources.map((s) => `[${s.name}](${s.url})`).join(" · ")}\n`
  );
  return lines.join("\n");
}

export interface RenderOptions {
  readerName?: string;
  preset?: string;
  since?: Date;
  until?: Date;
}

export function renderMarkdown(items: BriefItem[], options: RenderOptions = {}): string {
  const now = new Date();

  // Build title
  const name = options.readerName || "PulseBrief";
  const presetLabel = options.preset
    ? options.preset.charAt(0).toUpperCase() + options.preset.slice(1)
    : "Update";
  const title = `${name}'s ${presetLabel} Pulse`;

  // Build window line from actual since/until, not from item dates
  let windowLine: string;
  if (options.since && options.until) {
    windowLine = `${formatDateTime(options.since)} → ${formatDateTime(options.until)}`;
  } else if (options.since) {
    windowLine = `${formatDateTime(options.since)} → ${formatDateTime(now)}`;
  } else {
    windowLine = `as of ${formatDateTime(now)}`;
  }

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push(`*${windowLine}*\n`);

  if (items.length === 0) {
    lines.push("Nothing significant in this window.");
    return lines.join("\n");
  }

  for (const section of SECTIONS) {
    const sectionItems = items.filter((i) => i.section === section);
    if (sectionItems.length > 0) {
      lines.push(`## ${SECTION_LABELS[section]}\n`);
      sectionItems.forEach((item) => lines.push(renderItem(item)));
    }
  }

  return lines.join("\n");
}

export function renderHtml(markdown: string): string {
  let html = markdown
    // Links first — before italic/bold which would break them
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold before italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Block elements
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr>")
    // Paragraphs
    .replace(/\n\n/g, "</p>\n<p>")
    .replace(/\n/g, "<br>\n");

  return `<p>${html}</p>`;
}
