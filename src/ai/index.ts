import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { buildPersonaContext } from "../persona";
import { getRecentFeedback } from "../feedback";
import type { Persona, Settings } from "../config/schema";
import type Database from "better-sqlite3";

export interface BriefItem {
  section: "signal" | "industry";
  title: string;
  body: string;
  why: string;
  date: string;
  sources: { name: string; url: string }[];
}

interface GenerateBriefInput {
  db: Database.Database;
  persona: Persona;
  settings: Settings;
  since?: Date;
}

export async function generateBrief(input: GenerateBriefInput): Promise<BriefItem[]> {
  const { db, persona, settings, since } = input;

  // Determine what items to include
  let sinceTimestamp: string;
  if (since) {
    sinceTimestamp = since.toISOString();
    console.log(`[ai] Items published since ${since.toLocaleString()}`);
  } else {
    // Default: since last brief's anchor time, or last 24h on first run
    const lastBrief = db
      .prepare(`SELECT covers_until FROM briefs WHERE covers_until IS NOT NULL ORDER BY created_at DESC LIMIT 1`)
      .get() as { covers_until: string } | undefined;
    if (lastBrief) {
      sinceTimestamp = lastBrief.covers_until;
      console.log(`[ai] Items since ${new Date(sinceTimestamp).toLocaleString()}`);
    } else {
      sinceTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      console.log(`[ai] First run — items from last 24h`);
    }
  }

  const items = db
    .prepare(
      `SELECT title, source_name, content, url, published_at
       FROM items
       WHERE normalized = 1
         AND published_at > ?
       ORDER BY published_at DESC`
    )
    .all(sinceTimestamp) as {
    title: string;
    source_name: string;
    content: string;
    url: string;
    published_at: string | null;
  }[];

  if (items.length === 0) {
    console.log("[ai] No items to process");
    return [];
  }

  console.log(`[ai] Processing ${items.length} items through AI layer`);

  // Get recent briefs for context
  const recentBriefs = db
    .prepare(
      `SELECT rendered_md FROM briefs
       WHERE rendered_md IS NOT NULL
       ORDER BY created_at DESC LIMIT 3`
    )
    .all() as { rendered_md: string }[];

  const personaContext = buildPersonaContext(persona);
  const feedbackContext = getRecentFeedback(db);
  const systemPrompt = buildSystemPrompt({
    personaContext,
    items,
    recentBriefs: recentBriefs.map((b) => b.rendered_md),
    feedbackContext,
  });
  const userPrompt = buildUserPrompt(items);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: settings.ai.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("[ai] Failed to parse AI response as JSON");
    console.error("[ai] Raw response:", text.slice(0, 500));
    return [];
  }

  const briefItems: BriefItem[] = JSON.parse(jsonMatch[0]);
  console.log(`[ai] Brief generated: ${briefItems.length} items`);

  return briefItems;
}
