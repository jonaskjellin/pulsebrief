import type { Settings, SourcesConfig, Persona } from "../config/schema";
import type Database from "better-sqlite3";
import { fetchAllSources } from "../sources";
import { normalizeItems } from "../normalize";
import { generateBrief, type BriefItem } from "../ai";
import { deliverBrief } from "../deliver";

export interface PipelineContext {
  settings: Settings;
  sources: SourcesConfig;
  persona: Persona;
  db: Database.Database;
  since?: Date;
  coversUntil?: Date;  // preset anchor end time, or now for custom runs
  preset?: string;
}

export async function runPipeline(ctx: PipelineContext): Promise<BriefItem[]> {
  const { settings, sources, persona, db } = ctx;

  // Kick off fetch in background — brief generates from what's already in DB
  fetchAllSources(sources.sources, db)
    .then((result) => {
      normalizeItems(db);
      console.log(`[fetch] Done: ${result.new} new items stored for next run`);
    })
    .catch((err) => {
      console.error(`[fetch] Background fetch error: ${err.message}`);
    });

  // Generate brief from existing DB content
  console.log(`[pipeline] Generating brief...`);
  const briefItems = await generateBrief({ db, persona, settings, since: ctx.since });

  if (briefItems.length === 0) {
    console.log(`[pipeline] Nothing significant — no brief generated`);
    return [];
  }

  // Store — covers_until marks where this brief ends
  // "run" will pick up from the last brief's covers_until
  const coversUntil = ctx.coversUntil || new Date();
  const insertBrief = db.prepare(
    `INSERT INTO briefs (run_type, content_json, covers_until) VALUES (?, ?, ?)`
  );
  const briefJson = JSON.stringify(briefItems, null, 2);
  const info = insertBrief.run(ctx.preset || "custom", briefJson, coversUntil.toISOString());

  // Deliver
  const { markdown } = await deliverBrief(briefItems, settings.delivery.channels, ctx.preset);

  db.prepare("UPDATE briefs SET rendered_md = ? WHERE id = ?").run(
    markdown,
    info.lastInsertRowid
  );

  console.log("\n" + markdown);

  return briefItems;
}
