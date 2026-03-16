import "dotenv/config";
import { loadAllConfig } from "./config/loader";
import type { Settings } from "./config/schema";
import { runPipeline } from "./pipeline/runner";
import { fetchAllSources } from "./sources";
import { normalizeItems } from "./normalize";
import { listBriefs, getBriefItems, submitFeedback } from "./feedback";
import { publishSite } from "./publish";

// Build a Date object for a specific hour:minute in the configured timezone
function dateInTimezone(tz: string, year: number, month: number, day: number, hours: number, minutes: number): Date {
  // Create an ISO string for the target local time, then figure out the UTC offset
  // by comparing what that time means in the target timezone
  const guess = new Date(Date.UTC(year, month, day, hours, minutes, 0));
  const inTz = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
  const offset = inTz.getTime() - guess.getTime();
  return new Date(guess.getTime() - offset);
}

function getNowInTimezone(tz: string): { now: Date; year: number; month: number; day: number; hours: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10);
  return { now, year: get("year"), month: get("month") - 1, day: get("day"), hours: get("hour") };
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

  const tz = settings.timezone || "UTC";
  const { year, month, day, hours: currentHour } = getNowInTimezone(tz);

  // Build "until" — this preset's anchor time in the configured timezone
  const [anchorH, anchorM] = presetConfig.anchor.split(":").map(Number);
  let until = dateInTimezone(tz, year, month, day, anchorH, anchorM);

  // If we haven't reached this anchor yet today (in local time), use yesterday's
  if (currentHour < anchorH) {
    until = dateInTimezone(tz, year, month, day - 1, anchorH, anchorM);
  }

  // Build "since" — previous preset's anchor, relative to "until"
  const [sinceH, sinceM] = sincePreset.anchor.split(":").map(Number);
  const untilDate = new Date(until.toLocaleString("en-US", { timeZone: tz }));
  const untilDay = untilDate.getDate();
  const untilMonth = untilDate.getMonth();
  const untilYear = untilDate.getFullYear();

  let since: Date;
  if (sinceH >= anchorH) {
    // Previous preset is later in the day — must be day before
    since = dateInTimezone(tz, untilYear, untilMonth, untilDay - 1, sinceH, sinceM);
  } else {
    since = dateInTimezone(tz, untilYear, untilMonth, untilDay, sinceH, sinceM);
  }

  const fmt = (d: Date) => d.toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });

  const label = `${preset} — ${fmt(since)} → ${fmt(until)} (${tz})`;
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
        since,
      });
      publishSite(config.persona.profile.name);
    } else if (command in config.settings.briefs) {
      const { since, until, label } = getPresetWindow(command, config.settings);
      console.log(`[pulsebrief] ${label}`);

      await runPipeline({
        settings: config.settings,
        sources: config.sources,
        persona: config.persona,
        since,
        coversUntil: until,
        preset: command,
      });
      publishSite(config.persona.profile.name);
    } else if (command === "feedback") {
      // pulsebrief feedback <brief_id> <item_index> <signal> [comment]
      // pulsebrief feedback list — show recent briefs
      const subcommand = process.argv[3];

      if (!subcommand || subcommand === "list") {
        const briefs = listBriefs();
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
          const items = getBriefItems(briefId);
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
            submitFeedback({ brief_id: briefId, item_index: itemIndex, signal: signal as any, comment });
            console.log(`[feedback] Recorded: item ${itemIndex} → ${signal}${comment ? ` ("${comment}")` : ""}`);
          }
        }
      }
    } else if (command === "publish") {
      publishSite(config.persona.profile.name);
    } else if (command === "fetch") {
      const result = await fetchAllSources(config.sources.sources);
      console.log(`[pulsebrief] Fetch complete: ${result.items.length} items`);
      if (result.errors.length > 0) {
        console.log(`[pulsebrief] ${result.errors.length} source(s) failed:`);
        result.errors.forEach((e) => console.log(`  - ${e}`));
      }
      const normResult = normalizeItems(result.items);
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
      console.log("  pulsebrief publish          — publish site to GitHub Pages");
      console.log("  pulsebrief fetch            — fetch only, no brief");
    }
  } catch (err) {
    throw err;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[pulsebrief] Fatal error:", err);
    process.exit(1);
  });
