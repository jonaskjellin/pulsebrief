import fs from "fs";
import path from "path";

const STATE_DIR = path.resolve(__dirname, "../../site/state");

export interface BriefRecord {
  id: number;
  run_type: string;
  covers_until: string;
  created_at: string;
  rendered_md: string;
}

export interface FeedbackRecord {
  brief_id: number;
  item_index: number;
  signal: "useful" | "not_useful" | "more_like_this" | "less_like_this";
  comment?: string;
  created_at: string;
}

function ensureStateDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function briefsPath(): string {
  return path.join(STATE_DIR, "briefs.json");
}

function feedbackPath(): string {
  return path.join(STATE_DIR, "feedback.json");
}

// --- Briefs ---

export function readBriefs(): BriefRecord[] {
  const p = briefsPath();
  if (!fs.existsSync(p)) return [];
  const data = fs.readFileSync(p, "utf-8");
  try {
    return JSON.parse(data) as BriefRecord[];
  } catch {
    return [];
  }
}

export function writeBriefs(briefs: BriefRecord[]): void {
  ensureStateDir();
  fs.writeFileSync(briefsPath(), JSON.stringify(briefs, null, 2), "utf-8");
}

export function appendBrief(brief: Omit<BriefRecord, "id">): number {
  const briefs = readBriefs();
  const id = briefs.length > 0 ? Math.max(...briefs.map((b) => b.id)) + 1 : 1;
  const record: BriefRecord = { id, ...brief };
  briefs.push(record);
  writeBriefs(briefs);
  return id;
}

export function updateBriefRenderedMd(id: number, renderedMd: string): void {
  const briefs = readBriefs();
  const brief = briefs.find((b) => b.id === id);
  if (brief) {
    brief.rendered_md = renderedMd;
    writeBriefs(briefs);
  }
}

export function getLastCoversUntil(): string | undefined {
  const briefs = readBriefs();
  // Find the most recent brief with a covers_until
  const sorted = briefs
    .filter((b) => b.covers_until)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return sorted[0]?.covers_until;
}

export function getRecentBriefsMd(limit: number = 3): string[] {
  const briefs = readBriefs();
  return briefs
    .filter((b) => b.rendered_md)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((b) => b.rendered_md);
}

// --- Feedback ---

export function readFeedback(): FeedbackRecord[] {
  const p = feedbackPath();
  if (!fs.existsSync(p)) return [];
  const data = fs.readFileSync(p, "utf-8");
  try {
    return JSON.parse(data) as FeedbackRecord[];
  } catch {
    return [];
  }
}

export function writeFeedback(feedback: FeedbackRecord[]): void {
  ensureStateDir();
  fs.writeFileSync(feedbackPath(), JSON.stringify(feedback, null, 2), "utf-8");
}

export function appendFeedback(entry: Omit<FeedbackRecord, "created_at">): void {
  const feedback = readFeedback();
  feedback.push({ ...entry, created_at: new Date().toISOString() });
  writeFeedback(feedback);
}
