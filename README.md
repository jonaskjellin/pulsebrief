# PulseBrief

A personal AI-powered intelligence brief. Fetches from configured sources, filters through your personal lens using Claude, and delivers a concise, opinionated brief.

Not a feed reader. Not a dashboard. A brief — opinionated, concise, and personal.

## Quick start

```bash
npm install
cp .env.example .env
# Add your Anthropic API key to .env
```

Edit `config/persona.yaml` to describe who you are and what you care about. Then:

```bash
npx tsx src/index.ts morning
```

## Usage

### Predefined briefs

Fixed time windows that always cover the same period, regardless of when you run them.

```bash
npx tsx src/index.ts morning      # yesterday 18:00 → today 07:00
npx tsx src/index.ts afternoon    # today 07:00 → 13:00
npx tsx src/index.ts evening      # today 13:00 → 18:00
```

If you run `morning` before 07:00, it generates yesterday's morning brief. The windows are fixed — they don't shift based on when you execute the command.

Running the same preset again overwrites the previous file (`2026-03-15-morning.md`).

### Ad-hoc briefs

```bash
npx tsx src/index.ts run              # everything since your last brief
npx tsx src/index.ts run --hours=4    # last 4 hours
```

`run` picks up from wherever your last brief ended. It doesn't matter if the last brief was a `morning`, `evening`, or a custom `--hours` run.

### Other commands

```bash
npx tsx src/index.ts fetch            # fetch sources without generating a brief
npx tsx src/index.ts feedback         # rate brief items to improve future briefs
```

## Configuration

All configuration lives in `config/`. No code changes needed to add sources, adjust timing, or update your persona.

### `config/persona.yaml` — who you are

This is the most important file. It tells the AI what matters to you specifically.

```yaml
profile:
  name: "Your Name"
  role: "Your role"
  background: "Your background"

focus:
  current:
    - "What you're actively working on right now"
  standing:
    - "Topics you always care about"

exclusions:
  topics:
    - "Things you don't want to see"
```

The brief quality is directly tied to how well this file describes you. Update it as your focus changes.

### `config/sources.yaml` — where to fetch from

Add or remove RSS feeds. No code changes needed.

```yaml
sources:
  - name: "Source Name"
    type: rss
    url: "https://example.com/feed/"
    domain: cybersecurity
```

Supported types: `rss`. API and scrape adapters can be added.

### `config/settings.yaml` — timing and delivery

```yaml
briefs:
  morning:
    anchor: "07:00"
    since: "evening"
  afternoon:
    anchor: "13:00"
    since: "morning"
  evening:
    anchor: "18:00"
    since: "afternoon"
```

Each preset has an anchor time and references the previous preset. Add new presets by adding entries here — they become available as commands automatically.

#### Email delivery

Uncomment the email channel in settings and set `SMTP_USER` and `SMTP_PASS` in `.env`:

```yaml
delivery:
  channels:
    - type: file
      path: "data/briefs"
    - type: email
      smtp_host: "smtp.example.com"
      smtp_port: 587
      smtp_user_env: "SMTP_USER"
      smtp_pass_env: "SMTP_PASS"
      from: "pulsebrief@example.com"
      to: "you@example.com"
```

## Feedback

Rate items from past briefs to improve future output:

```bash
npx tsx src/index.ts feedback                           # list recent briefs
npx tsx src/index.ts feedback 1                         # show items in brief #1
npx tsx src/index.ts feedback 1 0 useful                # mark item 0 as useful
npx tsx src/index.ts feedback 1 2 less "not relevant"   # mark item 2 as less relevant
```

Signals: `useful`, `not_useful`, `more` (more like this), `less` (less like this). Optional comment at the end.

Feedback is fed into the AI prompt on subsequent runs to calibrate what gets included.

## How it works

1. **Fetch** — pulls from all configured RSS sources in parallel (runs in background)
2. **Filter** — Claude reads all items alongside your persona, recent briefs, and feedback history
3. **Synthesize** — same story from multiple sources becomes one item; items that don't meet the bar are dropped
4. **Deliver** — renders to Markdown file and/or email

The brief generates from items already in the database. Fetching runs concurrently in the background to replenish the database for the next run. This keeps generation fast (~20 seconds).

## Output

Briefs are written to `data/briefs/`:

```
data/briefs/2026-03-15-morning.md       # preset — overwrites on re-run
data/briefs/2026-03-15-afternoon.md
data/briefs/2026-03-15-1430.md          # ad-hoc — timestamped
```

Each brief includes:
- Generation timestamp
- Source time range (oldest → newest item)
- Items split into **Signal** (events, shifts) and **Industry** (discussions, trends)
- Per-item publish date, synthesis, why it matters to you, and source links

## Environment

Requires Node.js 18+ and an Anthropic API key.

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Project structure

```
config/
  persona.yaml        — who you are
  sources.yaml        — where to fetch from
  settings.yaml       — timing, delivery, AI model
src/
  index.ts            — CLI entry point
  config/             — config loading and validation
  sources/            — fetch adapters (RSS)
  normalize/          — HTML cleanup, deduplication
  ai/                 — Claude prompt building and synthesis
  persona/            — persona context for AI
  deliver/            — file and email output
  feedback/           — feedback storage and retrieval
  pipeline/           — orchestration
  db/                 — SQLite setup
data/
  pulsebrief.db       — SQLite database
  briefs/             — generated briefs
```
