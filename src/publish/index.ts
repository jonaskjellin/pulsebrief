import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { readBriefs, type BriefRecord } from "../state";
import { renderHtml } from "../deliver/render";

const SITE_DIR = path.resolve(__dirname, "../../site");
const SITE_REPO = "jonaskjellin/pulsebrief-site";

function ensureSiteRepo(): void {
  if (!fs.existsSync(path.join(SITE_DIR, ".git"))) {
    fs.mkdirSync(SITE_DIR, { recursive: true });
    execSync(`git clone git@github.com:${SITE_REPO}.git ${SITE_DIR}`, { stdio: "pipe" });
  } else {
    execSync("git pull --rebase", { cwd: SITE_DIR, stdio: "pipe" });
  }
}

function buildBriefPage(brief: BriefRecord): string {
  const content = renderHtml(brief.rendered_md);
  return wrapHtml(content, getBriefTitle(brief));
}

function getBriefTitle(brief: BriefRecord): string {
  const date = new Date(brief.created_at);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const type = brief.run_type.charAt(0).toUpperCase() + brief.run_type.slice(1);
  return `${type} — ${dateStr}`;
}

function getBriefFilename(brief: BriefRecord): string {
  const date = new Date(brief.created_at).toISOString().split("T")[0];
  return `${date}-${brief.run_type}.html`;
}

function wrapHtml(body: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — PulseBrief</title>
  <link rel="alternate" type="application/atom+xml" title="PulseBrief Feed" href="/feed.xml">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px 16px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 1.6em; margin-bottom: 4px; }
    h2 { font-size: 1.2em; margin-top: 32px; margin-bottom: 16px; color: #444; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    h3 { font-size: 1em; margin-top: 20px; margin-bottom: 4px; }
    h3 a { color: #1a1a1a; text-decoration: none; border-bottom: 1px solid #ccc; }
    h3 a:hover { border-color: #333; }
    p { margin-bottom: 12px; }
    blockquote { border-left: 3px solid #ddd; padding-left: 12px; color: #555; margin: 8px 0 12px; }
    em { font-style: italic; }
    a { color: #0066cc; }
    hr { border: none; border-top: 1px solid #eee; margin: 32px 0; }
    .meta { color: #888; font-size: 0.9em; }
    .sources { font-size: 0.85em; color: #666; }
    .nav { margin-bottom: 24px; font-size: 0.9em; }
    .nav a { color: #0066cc; text-decoration: none; }
    .brief-list { list-style: none; }
    .brief-list li { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .brief-list a { text-decoration: none; color: #1a1a1a; }
    .brief-list .date { color: #888; font-size: 0.85em; }
  </style>
</head>
<body>
  <div class="nav"><a href="/">← All Briefs</a> · <a href="/feed.xml">RSS</a></div>
  ${body}
</body>
</html>`;
}

function buildIndexPage(briefs: BriefRecord[]): string {
  const items = briefs.map((b) => {
    const filename = getBriefFilename(b);
    const title = getBriefTitle(b);
    const date = new Date(b.created_at);
    const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `<li><a href="/${filename}"><strong>${title}</strong> <span class="date">${timeStr}</span></a></li>`;
  });

  const body = `
    <h1>PulseBrief</h1>
    <p class="meta">Personal intelligence briefs · <a href="/feed.xml">RSS Feed</a></p>
    <ul class="brief-list">
      ${items.join("\n      ")}
    </ul>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PulseBrief</title>
  <link rel="alternate" type="application/atom+xml" title="PulseBrief Feed" href="/feed.xml">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px 16px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 1.6em; margin-bottom: 4px; }
    .meta { color: #888; font-size: 0.9em; margin-bottom: 24px; }
    .brief-list { list-style: none; }
    .brief-list li { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .brief-list a { text-decoration: none; color: #1a1a1a; display: block; }
    .brief-list a:hover { color: #0066cc; }
    .brief-list .date { color: #888; font-size: 0.85em; margin-left: 8px; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function buildAtomFeed(briefs: BriefRecord[], siteUrl: string): string {
  const entries = briefs.slice(0, 20).map((b) => {
    const filename = getBriefFilename(b);
    const title = getBriefTitle(b);
    const date = new Date(b.created_at).toISOString();
    const htmlContent = renderHtml(b.rendered_md)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `  <entry>
    <title>${title}</title>
    <link href="${siteUrl}/${filename}"/>
    <id>${siteUrl}/${filename}</id>
    <updated>${date}</updated>
    <content type="html">${htmlContent}</content>
  </entry>`;
  });

  const updated = briefs.length > 0
    ? new Date(briefs[0].created_at).toISOString()
    : new Date().toISOString();

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>PulseBrief</title>
  <subtitle>Personal intelligence briefs</subtitle>
  <link href="${siteUrl}/feed.xml" rel="self"/>
  <link href="${siteUrl}/"/>
  <id>${siteUrl}/</id>
  <updated>${updated}</updated>
${entries.join("\n")}
</feed>`;
}

export function publishSite(siteUrl: string = "https://jonaskjellin.github.io/pulsebrief-site"): void {
  console.log("[publish] Building site...");

  // Get all briefs with rendered content from state file
  const allBriefs = readBriefs();
  const briefs = allBriefs
    .filter((b) => b.rendered_md)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (briefs.length === 0) {
    console.log("[publish] No briefs to publish");
    return;
  }

  ensureSiteRepo();

  // Generate individual brief pages
  for (const brief of briefs) {
    const filename = getBriefFilename(brief);
    const html = buildBriefPage(brief);
    fs.writeFileSync(path.join(SITE_DIR, filename), html, "utf-8");
  }

  // Generate index
  fs.writeFileSync(path.join(SITE_DIR, "index.html"), buildIndexPage(briefs), "utf-8");

  // Generate Atom feed
  fs.writeFileSync(path.join(SITE_DIR, "feed.xml"), buildAtomFeed(briefs, siteUrl), "utf-8");

  // Push to GitHub
  try {
    execSync("git add -A", { cwd: SITE_DIR, stdio: "pipe" });
    const status = execSync("git status --porcelain", { cwd: SITE_DIR }).toString().trim();
    if (!status) {
      console.log("[publish] No changes to publish");
      return;
    }
    execSync(`git commit -m "Update briefs — ${new Date().toISOString()}"`, { cwd: SITE_DIR, stdio: "pipe" });
    execSync("git push", { cwd: SITE_DIR, stdio: "pipe" });
    console.log(`[publish] Site published to ${siteUrl}`);
  } catch (err) {
    console.error("[publish] Git push failed:", (err as Error).message);
  }
}
