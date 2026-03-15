import type { Settings, SourcesConfig, Persona } from "../config/schema";
import { fetchAllSources } from "../sources";
import { normalizeItems } from "../normalize";
import { generateBrief, type BriefItem } from "../ai";
import { deliverBrief } from "../deliver";
import { appendBrief, updateBriefRenderedMd } from "../state";

export interface PipelineContext {
  settings: Settings;
  sources: SourcesConfig;
  persona: Persona;
  since?: Date;
  coversUntil?: Date;  // preset anchor end time, or now for custom runs
  preset?: string;
}

export async function runPipeline(ctx: PipelineContext): Promise<BriefItem[]> {
  const { settings, sources, persona } = ctx;

  // Fetch all sources
  console.log(`[pipeline] Fetching sources...`);
  const fetchResult = await fetchAllSources(sources.sources);
  console.log(`[pipeline] Fetched ${fetchResult.items.length} items total`);
  if (fetchResult.errors.length > 0) {
    console.log(`[pipeline] ${fetchResult.errors.length} source(s) failed`);
  }

  // Normalize in memory
  const { items: normalizedItems, normalized, skipped } = normalizeItems(fetchResult.items);
  console.log(`[pipeline] Normalized: ${normalized}, skipped: ${skipped}`);

  // Generate brief from normalized items
  console.log(`[pipeline] Generating brief...`);
  const briefItems = await generateBrief({
    items: normalizedItems,
    persona,
    settings,
    since: ctx.since,
    until: ctx.coversUntil,
  });

  if (briefItems.length === 0) {
    console.log(`[pipeline] Nothing significant — no brief generated`);
    return [];
  }

  // Store brief in state file
  const coversUntil = ctx.coversUntil || new Date();
  const briefId = appendBrief({
    run_type: ctx.preset || "custom",
    covers_until: coversUntil.toISOString(),
    created_at: new Date().toISOString(),
    rendered_md: "",
  });

  // Deliver
  const { markdown } = await deliverBrief(briefItems, settings.delivery.channels, {
    readerName: persona.profile.name,
    preset: ctx.preset,
    since: ctx.since,
    until: ctx.coversUntil,
  });

  // Update brief with rendered markdown
  updateBriefRenderedMd(briefId, markdown);

  console.log("\n" + markdown);

  return briefItems;
}
