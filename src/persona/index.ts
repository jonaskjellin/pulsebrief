import type { Persona } from "../config/schema";

export function buildPersonaContext(persona: Persona): string {
  const parts: string[] = [];
  const p = persona.profile;

  parts.push("## Reader Profile");
  if (p.name) parts.push(`Name: ${p.name}`);
  parts.push(`Role: ${p.role}`);
  if (p.organization_type) parts.push(`Organization: ${p.organization_type}`);
  if (p.reports_to) parts.push(`Reports to: ${p.reports_to}`);
  if (p.location) parts.push(`Location: ${p.location}`);
  if (p.experience_years) parts.push(`Experience: ${p.experience_years} years`);
  if (p.background) parts.push(`Background: ${p.background}`);

  if (persona.focus.current.length > 0) {
    parts.push("\n## Current Focus (highest priority)");
    persona.focus.current.forEach((f) => parts.push(`- ${f}`));
  }

  if (persona.focus.standing.length > 0) {
    parts.push("\n## Standing Interests");
    persona.focus.standing.forEach((f) => parts.push(`- ${f}`));
  }

  if (persona.reading_lens) {
    parts.push(`\n## Reading Lens\n${persona.reading_lens}`);
  }

  if (persona.exclusions.topics.length > 0 || persona.exclusions.source_types.length > 0) {
    parts.push("\n## Exclusions");
    if (persona.exclusions.topics.length > 0) {
      parts.push("Topics to deprioritize:");
      persona.exclusions.topics.forEach((t) => parts.push(`- ${t}`));
    }
    if (persona.exclusions.source_types.length > 0) {
      parts.push("Source types to deprioritize:");
      persona.exclusions.source_types.forEach((s) => parts.push(`- ${s}`));
    }
  }

  parts.push("\n## Preferences");
  parts.push(`Tone: ${persona.preferences.tone}`);
  parts.push(`Depth: ${persona.preferences.depth}`);
  if (persona.preferences.format) parts.push(`Format: ${persona.preferences.format}`);
  parts.push(`Max items: ${persona.preferences.max_items}`);
  if (persona.preferences.flag_marketing) parts.push("Flag vendor-originated content explicitly");
  if (persona.preferences.variable_count) parts.push("Item count is variable — fewer on quiet days, more on significant days");

  return parts.join("\n");
}
