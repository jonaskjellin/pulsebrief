import "dotenv/config";
import { loadAllConfig } from "./config/loader";
import type { Settings } from "./config/schema";
import { getDb, closeDb } from "./db";
import { runPipeline } from "./pipeline/runner";
import { fetchAllSources } from "./sources";
import { normalizeItems } from "./normalize";
import { listBriefs, getBriefItems, submitFeedback } from "./feedback";

function parseAnchorTime(anchor: string): { hours: number; minutes: number } {
  const [h, m] = anchor.split(":").map(Number);
  return { hours: h, minutes: m };
}

function getPresetWindow(preset: string, settings: Settings): { since: Date; until: Date; label: string } {
  const presetConfig = settings.briefs[preset];
  if (!presetConfig) {
    const available = Object.keys(settings.briefs).join(", ");
    throw new Error(`Unknown preset "${preset}". Available: ${available}`);
  }

  const sincePreset = settings.briefs[presetConfig.since];
  if (!sincePreset) {
    throw new Error(`Preset "${preset}" references unknown preset "${presetConfig.since}"`);
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Build "until" — this preset's anchor time
  const anchor = parseAnchorTime(presetConfig.anchor);
  const until = new Date(today);
  until.setHours(anchor.hours, anchor.minutes, 0, 0);

  // If we haven't reached this anchor yet today, use yesterday's
  if (now < until) {
    until.setDate(until.getDate() - 1);
  }

  // Build "since" — previous preset's anchor, relative to "until"
  const sinceAnchor = parseAnchorTime(sincePreset.anchor);
  const since = new Date(until);
  since.setHours(sinceAnchor.hours, sinceAnchor.minutes, 0, 0);
  if (sinceAnchor.hours >= anchor.hours) {
    since.setDate(since.getDate() - 1);
  }

  const fmt = (d: Date) => {
    const dayDiff = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
    const dayLabel = dayDiff === 0 ? "today" : dayDiff === 1 ? "yesterday" : `${dayDiff}d ago`;
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${dayLabel} ${time}`;
  };

  const label = `${preset} — ${fmt(since)} → ${fmt(until)}`;
  return { since, until, label };
}

async function main() {
  const command = process.argv[2] || "run";

  console.log("[pulsebrief] Loading config...");

  let config;
  try {
    config = loadAllConfig();
  } catch (err) {
    console.error("[pulsebrief] Config error:", (err as Error).message);
    process.exit(1);
  }

  console.log("[pulsebrief] Config loaded successfully");

  const db = getDb(config.settings.database.path);
  console.log("[pulsebrief] Database initialized");

  try {
    if (command === "run") {
      const hoursArg = process.argv.find((a) => a.startsWith("--hours="));

      let since: Date | undefined;
      if (hoursArg) {
        const hours = parseInt(hoursArg.split("=")[1], 10);
        since = new Date(Date.now() - hours * 60 * 60 * 1000);
        console.log(`[pulsebrief] Generating brief — last ${hours}h`);
      } else {
        console.log(`[pulsebrief] Generating brief — since last run`);
      }

      await runPipeline({
        settings: config.settings,
        sources: config.sources,
        persona: config.persona,
        db,
        since,
      });
    } else if (command in config.settings.briefs) {
      const { since, until, label } = getPresetWindow(command, config.settings);
      console.log(`[pulsebrief] ${label}`);

      await runPipeline({
        settings: config.settings,
        sources: config.sources,
        persona: config.persona,
        db,
        since,
        coversUntil: until,
        preset: command,
      });
    } else if (command === "feedback") {
      // pulsebrief feedback <brief_id> <item_index> <signal> [comment]
      // pulsebrief feedback list — show recent briefs
      const subcommand = process.argv[3];

      if (!subcommand || subcommand === "list") {
        const briefs = listBriefs(db);
        if (briefs.length === 0) {
          console.log("[feedback] No briefs yet");
        } else {
          console.log("\nRecent briefs:");
          for (const b of briefs) {
            console.log(`  #${b.id} ${b.run_type.padEnd(10)} ${b.created_at}  (${b.item_count} items)`);
          }
          console.log("\nTo see items: pulsebrief feedback <brief_id>");
          console.log("To rate:      pulsebrief feedback <brief_id> <item#> useful|not_useful|more|less [comment]");
        }
      } else {
        const briefId = parseInt(subcommand, 10);
        const itemArg = process.argv[4];

        if (!itemArg) {
          // Show items in this brief
          const items = getBriefItems(db, briefId);
          if (items.length === 0) {
            console.log(`[feedback] Brief #${briefId} not found`);
          } else {
            console.log(`\nBrief #${briefId} items:`);
            items.forEach((item) => {
              console.log(`  ${item.index}. [${item.section}] ${item.title}`);
            });
            console.log("\nRate: pulsebrief feedback " + briefId + " <item#> useful|not_useful|more|less [comment]");
          }
        } else {
          const itemIndex = parseInt(itemArg, 10);
          const signalMap: Record<string, string> = {
            useful: "useful",
            not_useful: "not_useful",
            more: "more_like_this",
            less: "less_like_this",
          };
          const rawSignal = process.argv[5];
          const signal = signalMap[rawSignal];
          if (!signal) {
            console.log(`[feedback] Unknown signal "${rawSignal}". Use: useful, not_useful, more, less`);
          } else {
            const comment = process.argv.slice(6).join(" ") || undefined;
            submitFeedback(db, { brief_id: briefId, item_index: itemIndex, signal: signal as any, comment });
            console.log(`[feedback] Recorded: item ${itemIndex} → ${signal}${comment ? ` ("${comment}")` : ""}`);
          }
        }
      }
    } else if (command === "fetch") {
      const result = await fetchAllSources(config.sources.sources, db);
      console.log(`[pulsebrief] Fetch complete: ${result.total} total, ${result.new} new items`);
      if (result.errors.length > 0) {
        console.log(`[pulsebrief] ${result.errors.length} source(s) failed:`);
        result.errors.forEach((e) => console.log(`  - ${e}`));
      }
      const normResult = normalizeItems(db);
      console.log(`[pulsebrief] Normalized: ${normResult.normalized}, skipped: ${normResult.skipped}`);
    } else {
      console.log(`[pulsebrief] Unknown command: ${command}`);
      const presets = Object.entries(config.settings.briefs)
        .map(([name, p]) => `  pulsebrief ${name.padEnd(20)}— since ${p.since} (${p.anchor})`)
        .join("\n");
      console.log("Usage:");
      console.log("  pulsebrief run              — since last run");
      console.log("  pulsebrief run --hours=4    — last 4 hours");
      console.log(presets);
      console.log("  pulsebrief feedback         — rate brief items");
      console.log("  pulsebrief fetch            — fetch only, no brief");
    }
  } finally {
    closeDb();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pulsebrief] Fatal error:", err);
    process.exit(1);
  });
