# PulseBrief — Product Requirements Document

> Personal AI-powered intelligence brief  
> Version 0.1 — Draft  
> Audience: Claude Code — implementation agent

---

## 1. Purpose and vision

PulseBrief is a personal intelligence agent that replaces the daily manual effort of reading through dozens of news sources, security feeds, and industry channels. It fetches, filters, and synthesizes what matters to a specific person — not a generic audience — and delivers a concise, opinionated brief once or twice a day.

The core idea is simple: most information sources are too broad, too noisy, or too vendor-driven to be useful without a filter. PulseBrief applies a personal lens — informed by who the reader is, what they are working on right now, and what they have found relevant in the past — to decide what makes the cut.

This is not a dashboard. It is not a feed reader. It is a brief — opinionated, concise, and personal.

---

## 2. Problem statement

The target user has no efficient way to stay informed across multiple domains without significant manual effort. The available options all fail in the same way: they are built for a generic audience, not a specific person.

- Generic aggregators surface popular content, not relevant content
- RSS readers require manual triage of hundreds of items daily
- Email newsletters are frequently vendor-sponsored or recycled
- Social feeds mix signal with noise unpredictably
- Analyst reports are thorough but too slow for daily awareness

PulseBrief moves the filtering work to an AI layer that understands the reader personally.

---

## 3. User

PulseBrief v1 is built for a single user. There is no multi-user requirement, no public-facing interface, and no onboarding flow. The user is technical, comfortable with configuration, and willing to provide context about themselves to improve the output quality over time.

### 3.1 Persona store

The system maintains a persona store — a structured, human-editable file that describes the user's current context. This is not a static system prompt. It evolves as the user's focus changes, and can be updated directly by editing the file or by giving the system a natural language instruction to update it.

The persona store contains:

- Professional role and domain expertise
- Current active projects and focus areas
- Standing interests that persist across time
- Explicit exclusions — topics or source types to deprioritize
- Preferred depth and tone for the brief

### 3.2 Feedback and learning

After each brief the user can signal what was and was not useful. This feedback writes back to the persona store over time, gradually refining what the system surfaces. The system should learn from actual reading behavior, not just initial configuration.

---

## 4. Domains

PulseBrief is domain-agnostic. Domains are configured, not hardcoded. Adding a new domain is a configuration task — it requires no code changes, only new source definitions and an updated persona store.

| Domain | Status in v1 |
|---|---|
| Cybersecurity | Active — primary domain at launch |
| Startups & VC | Planned — configure sources when ready |
| Business & finance | Planned — configure sources when ready |
| AI & technology | Partial — surfaces through other domain lenses |

---

## 5. Brief structure

The brief is not a feed dump. It is a synthesized, opinionated document. The AI layer decides what to include, what to combine across sources, and what to drop entirely. There are two sections.

### 5.1 Signal — what happened and what is shifting

Significant events, emerging patterns, and shifts in the threat or industry landscape. The bar for inclusion is: would this change how the reader thinks about something? Not: is this recent or popular.

What belongs here: a major breach revealing a systemic control failure, a nation-state campaign shifting targeting patterns, a regulatory body signaling a new direction, a significant vendor move reshaping a market.

What does not belong here: CVE patch notices for specific products, vendor press releases, recycled incident reporting, anything operational rather than awareness-level.

### 5.2 Industry — what is being discussed

The conversation happening in the industry — what peers are debating, what analysts are publishing, what is shaping board and budget conversations. Forward-looking and contextual rather than event-driven.

### 5.3 Brief behavior

- Item count is variable — 3 items on a quiet day is correct; 8 on a significant day is also correct
- When multiple sources cover the same event, synthesize one item, not several
- Explicitly label when content appears to be vendor-originated or marketing-driven
- "Nothing significant today" is a valid and correct output — do not pad
- Each item includes a single line on why it made the cut relative to the user's persona

---

## 6. Architecture

PulseBrief is a pipeline with five logical stages. Claude Code selects the appropriate implementation for each stage. The architecture below is logical, not prescriptive on tooling or stack.

### 6.1 Trigger

The pipeline runs on a schedule. The morning run produces a full brief. An optional midday run produces a shorter update covering only what is new since morning. The trigger mechanism is an implementation detail.

### 6.2 Source integration

Sources are defined per domain in configuration, not in code. Each source has a type (RSS, REST API, scrape), a URL or endpoint, optional authentication, and optional filtering parameters. Adding or removing a source requires no code change.

The fetch layer retrieves raw content from all configured sources in parallel and normalizes each item to a common schema before passing it downstream.

### 6.3 Normalization and deduplication

Raw items from diverse sources have inconsistent structure. The normalization layer maps everything to a shared schema:

```
title, source, date, url, raw_content, domain_tag
```

Deduplication happens at two levels: URL-level (exact same link from multiple sources) and narrative-level (same story covered by multiple outlets). URL deduplication happens in the normalization layer. Narrative deduplication is handled by the AI layer.

### 6.4 AI layer — personalized filtering and synthesis

This is the core of PulseBrief. The AI receives the normalized item pool alongside three inputs:

1. **Persona store** — who the reader is and what they care about right now
2. **Brief history** — the last 3–5 generated briefs, to avoid repetition and track developing stories
3. **Current run context** — date, time of day, run type (morning or midday)

The prompt is built dynamically from the persona store on each run. There is no generic summarization prompt. If the user's focus has changed since yesterday, the next brief reflects that immediately.

### 6.5 Delivery

The brief is delivered to one or more configured destinations. Email is the primary channel. Additional channels (Slack, webhook, local file) are configuration options. Format adapts to the channel.

---

## 7. Persona store design

The persona store is a structured file — human-readable, human-editable, version-controlled alongside the codebase. It has three sections.

### 7.1 Standing profile

Stable facts about the user that change infrequently: professional domain, technical depth, industry background. Set up once, rarely touched.

### 7.2 Current focus

What the user is actively working on or thinking about right now. This is the highest-leverage section. It is what causes an AI security story to be elevated above a generic breach report, or a funding round in a specific sector to be included when it otherwise would not. This section should be easy to update — including through natural language commands to the system itself.

### 7.3 Exclusions and preferences

Explicit signals about what the user does not want: source types to deprioritize, topics that are noise for this specific user, preferred brief length and tone. Prevents the system from reverting to generic behavior over time.

---

## 8. Memory and evolution

### 8.1 Brief history

Every generated brief is stored. The AI reads recent history on each run to avoid repetition, track developing stories across days, and recognize when a pattern is emerging over time.

### 8.2 Feedback loop

After reading a brief the user can signal what was and was not useful. The mechanism should be as low-friction as possible. Feedback writes back to the persona store, gradually refining relevance filtering. The goal is that the brief becomes more accurate over weeks without requiring the user to manually maintain configuration.

---

## 9. Out of scope for v1

- Multi-user support
- Web interface or dashboard
- Real-time alerts — PulseBrief is a scheduled brief, not a monitoring tool
- Automated SIEM or ticketing integration
- Paid intelligence source integration — free and low-cost sources only at launch
- Mobile app

---

## 10. Success criteria

PulseBrief is working correctly when the user reads the brief every morning without skipping it — not because they feel obligated, but because it consistently contains something worth knowing that they would not have found efficiently on their own.

Secondary signal: the user stops manually checking the sources that PulseBrief covers.

Failure mode: the brief becomes predictable, padded, or dominated by a single source type. If the user starts skimming without reading, the filtering is not working.

---

*This PRD defines what PulseBrief must do, not how it must be built. Claude Code owns all implementation decisions — stack, structure, tooling, and file organization.*
