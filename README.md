![Perplexed: An Obsidian Plugin for Perplexity and Perplexica / Vane](https://i.imgur.com/MVOK3rk.png)
# Perplexed: AI Content Generation for Obsidian

**Perplexed** is an Obsidian plugin that enables AI-powered content generation with source citations using [Perplexity](https://www.perplexity.ai/), [Anthropic Claude](https://www.anthropic.com/), [Google Gemini](https://ai.google.dev/) (with Google Search grounding), and [Perplexica / Vane](https://github.com/ItzCrazyKns/Vane) (self-hosted). It also integrates [Exa](https://exa.ai/) as a **retrieval** layer — Exa finds and verifies the source material, and the writing model writes from it. This plugin brings research-grade AI capabilities directly into your Obsidian workspace, allowing you to generate well-cited content for your notes.

> **New in 0.4.0:** every one of Perplexed's settings now shows up in Obsidian's settings search, the preamble and frontmatter lists are real editable lists, and number fields tell you when a value won't work. Requires Obsidian 1.13 or later. [Release notes →](changelog/releases/0.4.0.md)

## 💼 For Venture Capital, Private Equity, and Equities-Trading Workflows

Perplexed ships a set of **analyst-grade directory templates** aimed at the research deliverables a VC analyst, PE associate, equity-research analyst, or trading-desk strategist produces daily. Drop an empty file into the matching folder, run *Apply directory template to current file*, and Perplexity Deep Research returns a 6-9K-word cited analyst draft you can curate into a memo for a partner, an IC, or a portfolio review.

| Workflow | Template | What it produces |
|---|---|---|
| **Naming the players in a category** (incumbents vs challengers vs innovators by financial stage) | `market-category-profile.md` → `concepts/Market-Categories/` | Three-tier company landscape with explicit definitions: **Incumbents** (public / late-stage private / PE-owned), **Challengers** (Series C+ scale-ups, recently public), **Innovators** (Pre-Seed through Series B). Plus Why Now / What's Happening sections covering CAGR + category-creation momentum, and an Industry Coverage section sub-grouped into Market Reports (Gartner, IDC, Forrester, ABI) / Industry Articles / Financial News (Bloomberg, FT, Pitchbook). |
| **Authoring a market map** (Known Category or Thesis-Driven) | `market-map-profile.md` → `lost-in-public/market-maps/` | Analyst-grade memo with 4-8 sub-segments, 20-40 named innovator cards (Offering / Funding / Why-they-matter / Coverage), Market Dynamics (Sizing / Adoption / Capital Flow), Frontier and Open Questions. Anti-incumbent editorial stance prevents big-tech over-representation. |
| **Profiling an open spec or standard** an investment thesis depends on | `standards-and-specs-profile.md` → `Sources/Standards-and-Specs/` | Five-way authority typing (de-jure / consortium / vendor-led-open / community / de-facto), three-tier adoption framing with notable holdouts, named editors, stewardship-transition stories, named public critics with their arguments. |
| **Catalogue an authoritative source** (book, person, channel, report, conference) | `source-profile.md` → `Sources/` | Type-aware emphasis (author / publisher / cadence / methodology), Google Books URL harvesting for books, signature-work catalog. |
| **Encyclopedia entry on a concept, pattern, or mental model** the desk repeatedly invokes | `concept-profile.md` → `concepts/` | Definition, usage, history, examples, case studies. Mermaid + LaTeX rendering discipline baked in for diagrams and formulas. |

Every analyst-grade template runs on `sonar-deep-research`, ships with idle-only timeout safety (`request-timeout-ms: 0`, per-chunk idle timer at 270s) and a 24,000-token output budget (`max-tokens: 24000`) — enough for the longest analyst drafts to land without silent mid-document truncation. See [Directory Templates](#directory-templates) below for the full set and the cft-block grammar for tuning your own.

## 🎯 Key Features
![Perplexed UI Modal interface](https://i.imgur.com/jaZ4UfS.png)
- **Source-Cited AI Responses**: Get AI-generated content with proper citations and references
   - Default format:
   > ```markdown
    ### Citations

[1]: 2024, Dec 13. [What is GRC (Governance, Risk and Compliance) - Metricstream](https://www.metricstream.com/learn/what-is-grc.html). Published: 2024-05-01 | Updated: 2024-12-13

[2]: 2025, Jun 16. [Governance, risk and compliance (GRC): Definitions and resources](https://www.diligent.com/resources/guides/grc). Published: 2025-05-27 | Updated: 2025-06-16
   > ```

- **Multiple AI Providers**: Support for Perplexity, Anthropic Claude, Google Gemini (with Google Search grounding), Perplexica / Vane (self-hosted), and LM Studio (local)
- **Retrieval Before Generation**: Exa finds the right company and returns structured facts — founding year, funding with round detail, headcount, named customers — which get spliced into the prompt as separately-numbered `[^E1]` sources before the writing model starts
- **Streaming Responses**: Real-time streaming of AI responses for better UX
- **Flexible Configuration**: Customizable endpoints, models, and parameters
- **Deep Research Mode**: Comprehensive research across hundreds of sources
- **Local LLM Support**: Integration with LM Studio for local AI processing

## Network use and accounts

Perplexed contacts these remote services on your behalf when you invoke
their respective commands. Nothing is sent automatically — only the
prompts you submit through a command modal, and any text you have
explicitly selected when invoking selection-based commands.

| Provider | Endpoint | Account | API key |
|---|---|---|---|
| Perplexity | `https://api.perplexity.ai/chat/completions` | Required | Required (paid) |
| Exa (retrieval only) | `https://api.exa.ai/search` | Required ([dashboard](https://dashboard.exa.ai/)) | Required (free tier: $20 signup credit + $10/month, no credit card) |
| Anthropic Claude | `https://api.anthropic.com/v1/messages` | Required | Required (paid) |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent` | Required ([AI Studio](https://aistudio.google.com/)) | Required (free tier available, no credit card) |
| Perplexica / Vane ([install required](https://github.com/ItzCrazyKns/Vane)) | `http://localhost:3030/api/search` (default; user-configurable) | Not required | Not required (self-hosted, runs locally) |
| LM Studio | `http://localhost:1234/v1/chat/completions` (default; user-configurable) | Not required | Not required (runs locally) |

When Gemini's `google_search` grounding is enabled, the plugin also issues
follow-up `GET` requests to `vertexaisearch.cloud.google.com/grounding-api-redirect/…`
URLs to resolve them to the real source page (so your `### Citations` footer
contains durable source URLs rather than short-lived Google redirects). The
follow-up requests go through Obsidian's `requestUrl` (Node-side), not the
browser fetch — no cross-origin permissions involved, and the request is
strictly URL-resolution, no auth header.

The plugin does not collect telemetry, ship vault content anywhere else,
or update itself — Obsidian handles plugin updates through the community
plugin directory.

## 📋 Table of Contents

- [For Venture Capital, Private Equity, and Equities-Trading Workflows](#-for-venture-capital-private-equity-and-equities-trading-workflows)
- [User Onboarding](#user-onboarding)
  - [Installation](#installation)
  - [Initial Setup](#initial-setup)
  - [Using Perplexity](#using-perplexity)
  - [Using Google Gemini](#using-google-gemini)
  - [Using Perplexica / Vane](#using-perplexica--vane)
  - [Using LM Studio](#using-lm-studio)
  - [Command Reference](#command-reference)
  - [Directory Templates](#directory-templates)
    - [Retrieval before generation — Exa](#retrieval-before-generation--exa)
- [Releases](#releases)
- [Developer Onboarding](#developer-onboarding)
  - [Project Structure](#project-structure)
  - [Development Setup](#development-setup)
  - [Architecture Overview](#architecture-overview)
  - [Contributing](#contributing)

---

# User Onboarding

## Installation

**Requires Obsidian 1.13 or later** (desktop only). Perplexed 0.3.1 remains available for older Obsidian versions on the [releases page](https://github.com/lossless-group/perplexed-plugin/releases).

1. **Download the plugin**:
   - From the [latest release](https://github.com/lossless-group/perplexed-plugin/releases/latest), download `main.js`, `manifest.json`, and `styles.css`
   - Put the three files in a folder named `perplexed` inside your vault's plugins folder: `<your vault>/.obsidian/plugins/perplexed/`

2. **Enable in Obsidian**:
   - Open Obsidian Settings → Community plugins
   - Turn on community plugins if they are off, then reload the list
   - Enable "Perplexed"

Every setting below is also reachable from Obsidian's settings search: type "Exa", "system prompt", or "LM Studio endpoint" and jump straight to the row.

## Initial Setup

### 1. Configure Perplexity (Recommended for most users)

Perplexity is a commercial AI service that provides high-quality, source-cited responses.

1. **Get API Key**:
   - Visit [Perplexity AI](https://www.perplexity.ai/)
   - Sign up for an account
   - Navigate to API settings to get your API key

2. **Configure in Plugin**:
   - Open Obsidian Settings → Community Plugins → Perplexed
   - Enter your Perplexity API key
   - The default endpoint should work: `https://api.perplexity.ai/chat/completions`

### 2. Configure Google Gemini (Free tier available)

Google Gemini is Google's commercial AI service. The `google_search` grounding tool returns per-segment citation attribution — meaning each cited sentence is mapped back to the specific URL it came from, which becomes the verbatim quote in your `### Citations` footer. AI Studio's free tier requires **no credit card** to get started.

1. **Get API key**:
   - Visit [Google AI Studio](https://aistudio.google.com/apikey)
   - Sign in with a Google account
   - Click "Create API key" → copy the `AIza…` string

2. **Configure in plugin**:
   - Open Obsidian Settings → Community Plugins → Perplexed
   - Scroll to **Gemini (Google)**
   - Paste your API key into "Gemini API key"
   - Default model: `gemini-flash-latest` (always-current Flash, free-tier friendly) — `gemini-pro-latest` and pinned `gemini-2.5-pro` / `gemini-2.5-flash` also available
   - Leave **Enable Google search grounding by default** on for source-cited research
   - Leave **Resolve citation URLs** on — this is what turns the grounding-redirect URLs into the real source URLs in your citations footer

### 3. Configure Perplexica / Vane (self-hosted — requires local install)

Perplexica / Vane is a free, open-source AI search engine that you run
**locally on your own machine**. This plugin does not bundle the server
or proxy to a hosted instance — you must install and run it yourself
before the "Ask Perplexica / Vane" command will work.

> **Note on naming:** The maintainer (`ItzCrazyKns`) renamed the
> open-source self-hosted repo from **Perplexica** to **Vane** on
> 2026-03-09 (commit `feat(app): rename to 'vane'`). The old GitHub URL
> `ItzCrazyKns/Perplexica` redirects to `ItzCrazyKns/Vane`. A hosted
> service at [perplexica.io](https://perplexica.io/) remains live under
> the Perplexica name — that's a separate hosted product, not what you
> self-install for use with this plugin. The local API surface this
> plugin talks to (`/api/search`, focus modes, optimization modes) is
> unchanged across the rename.

1. **Install Perplexica / Vane locally**:
   - Repo and full installation docs:
     [github.com/ItzCrazyKns/Vane](https://github.com/ItzCrazyKns/Vane)
   - Docker is the recommended install path; the repo's README walks
     through `docker-compose` setup, configuring SearXNG, and choosing
     your local LLM provider (Ollama, LM Studio, OpenAI-compatible
     endpoints, etc.).
   - Confirm the server is running and reachable, e.g.:
     `curl http://localhost:3030/api/search`

2. **Configure in this plugin**:
   - Open Obsidian Settings → Community Plugins → Perplexed
   - Set the Perplexica / Vane endpoint to where your local server is
     listening (default: `http://localhost:3030/api/search`)
   - Pick a focus mode, optimization mode, and the local model you've
     configured the server to use

### 4. Configure LM Studio (Optional)

For local AI processing without internet dependency:

1. **Install LM Studio**:
   - Download from [LM Studio](https://lmstudio.ai/)
   - Install and start the application

2. **Configure in Plugin**:
   - Set LM Studio endpoint: `http://localhost:1234/v1/chat/completions`
   - Choose your preferred local model

## Using Perplexity

### Quick Start

1. **Open Command Palette**: `Ctrl/Cmd + P`
2. **Run Command**: Type "Ask Perplexity" and select it
3. **Enter Your Question**: Type your research question
4. **Configure Options**:
   - **Model**: Choose from available Perplexity models
   - **Citations**: Enable/disable source citations
   - **Images**: Include image results
   - **Recency Filter**: Filter results by time period
   - **Streaming**: Enable real-time response streaming

### Available Models

- **sonar-pro**: Balanced performance and quality (recommended)
- **sonar-small**: Fast responses, good for simple queries
- **sonar-deep-research**: Comprehensive research across hundreds of sources
- **llama-3.1-sonar-small-128k-online**: Extended context window
- **llama-3.1-sonar-large-128k-online**: Large model with extended context

### Example Usage

#### Basic Research Query
```
Question: "What are the latest developments in quantum computing?"
Model: sonar-pro
Citations: Enabled
Recency: Past month
```

#### Deep Research Analysis
```
Question: "Analyze the impact of AI on healthcare in the last 5 years"
Model: sonar-deep-research
Citations: Enabled
Recency: Past 5 years
```

**Note**: Deep research mode conducts exhaustive analysis across hundreds of sources and may take 30-60 seconds.

### Response Format

Perplexity responses include:
- **Main Answer**: Comprehensive response to your question
- **Citations**: Numbered references with source links
- **Images**: Relevant images (if enabled)
- **Related Questions**: Additional questions for exploration (if enabled)

### Text Enhancement

Enhance selected text using Perplexity AI to improve clarity, add details, and make content more comprehensive.

#### Quick Start

1. **Select Text**: Highlight the text you want to enhance in your note
2. **Open Command Palette**: `Ctrl/Cmd + P`
3. **Run Command**: Type "Enhance Selected Text with Perplexity" and select it
4. **Configure Options**:
   - **Model**: Choose from available Perplexity models
   - **Citations**: Enable/disable source citations
   - **Images**: Include image results
   - **Streaming**: Enable real-time response streaming

#### Enhancement Options

- **Replace Original**: Replace the selected text with the enhanced version
- **Insert Below**: Insert the enhanced text below the current cursor position
- **Preview**: Review the enhanced text before applying changes

#### Example Usage

**Original Text**:
```
AI is changing how we work.
```

**Enhanced Text**:
```
Artificial Intelligence (AI) is fundamentally transforming how we work across various industries and sectors. From automating routine tasks to enabling more sophisticated decision-making processes, AI technologies are reshaping traditional workflows and creating new opportunities for productivity and innovation.
```

## Using Google Gemini

### Quick start

1. **Open Command Palette**: `Ctrl/Cmd + P`
2. **Run Command**: Type "Ask Gemini" and select it
3. **Enter your question** in the textarea
4. **Configure options** in the modal:
   - **Model**: `gemini-flash-latest` (recommended, free-tier friendly), `gemini-pro-latest`, or pinned 2.5 versions
   - **Enable Google search grounding**: server-side `google_search` tool; emits per-segment citations
   - **Append Google searches list**: appends a Markdown bullet list of the queries Gemini ran, each linked to `google.com/search` (Markdown-native substitute for Google's required Search Suggestions chip)
   - **Resolve citation urls**: resolves the `vertexaisearch.cloud.google.com` grounding-redirect URLs to durable source URLs + real page titles before writing the citations footer
   - **Stream response**: incremental writing to the note as the response arrives

### Available models

- **gemini-flash-latest**: Google's always-current Flash alias, free-tier friendly (recommended default)
- **gemini-pro-latest**: Always-current Pro alias for deepest reasoning
- **gemini-2.5-pro**: Pinned Pro version (free-tier quota typically exhausted; paid tier required)
- **gemini-2.5-flash**: Pinned Flash version for reproducibility

### Why Gemini's citations are different

Gemini's `groundingSupports[]` carries per-segment attribution that survives the full response round-trip — meaning the `### Citations` footer contains the verbatim quote per source, attached to the prose above it. Compare to Claude's `web_search_20260209`, where the dynamic-filter sandbox post-processes search results and per-claim attachment doesn't survive: text blocks come back with `citations: null`.

The plugin walks two layers of provenance:

| Layer | Field | What it gives you |
|---|---|---|
| Page-level | `groundingChunks[]` | URL + title per page Gemini consulted |
| Segment-level | `groundingSupports[]` | Text span (`segment.text`) → indices into `groundingChunks[]` |

Page-level chunks become URL-and-title fallbacks; segment-level supports enrich them with the verbatim quote Gemini grounded against. Citation footer mirrors Claude's exactly (`[N]: [Title](url). > cited_text`) so [cite-wide](https://github.com/lossless-group/cite-wide)'s hex-substitution pass works on Gemini output too.

### Example usage

#### Basic research with grounding
```
Question: "Who won the 2024 Nobel Prize in Physics and what was the citation?"
Model: gemini-flash-latest
Grounding: Enabled
Resolve URLs: Enabled
```

Lands in the note with prose like:

> The 2024 Nobel Prize in Physics was jointly awarded to John J. Hopfield and Geoffrey Hinton.
>
> The Nobel Prize Committee cited them "for foundational discoveries and inventions that enable machine learning with artificial neural networks".

…followed by a `### Google Searches` section listing the queries Gemini issued, and a `### Citations` footer where each entry is `[N]: [Real Page Title](https://nobelprize.org/…)` with the verbatim segment as a blockquote.

## Using Perplexica / Vane

### Quick Start

1. **Open Command Palette**: `Ctrl/Cmd + P`
2. **Run Command**: Type "Ask Perplexica / Vane" and select it
3. **Enter Your Question**: Type your research question
4. **Configure Options**:
   - **Focus Mode**: Choose search specialization
   - **Optimization**: Balance speed vs. quality
   - **Streaming**: Enable real-time response streaming

### Focus Modes

- **webSearch**: General web search (default)
- **academicSearch**: Academic and research papers
- **writingAssistant**: Writing and content creation
- **wolframAlpha**: Mathematical and computational queries
- **youtubeSearch**: Video content search
- **redditSearch**: Reddit community discussions

### Optimization Modes

- **speed**: Fastest responses
- **balanced**: Good balance of speed and quality
- **quality**: Highest quality responses

### Example Usage

#### Academic Research
```
Question: "What are the current theories about dark matter?"
Focus Mode: academicSearch
Optimization: quality
```

#### Content Writing
```
Question: "Help me write an introduction about climate change"
Focus Mode: writingAssistant
Optimization: balanced
```

## Using LM Studio

### Quick Start

1. **Open Command Palette**: `Ctrl/Cmd + P`
2. **Run Command**: Type "Ask LM Studio" and select it
3. **Enter Your Question**: Type your question
4. **Configure Options**:
   - **Model**: Choose your local model
   - **System Prompt**: Customize AI behavior
   - **Temperature**: Control response creativity
   - **Max Tokens**: Limit response length

### Example Usage

#### Creative Writing
```
Question: "Write a short story about a robot learning to paint"
Model: ibm/granite-3.2-8b
Temperature: 0.8
System Prompt: "You are a creative storyteller who writes engaging narratives."
```

#### Technical Analysis
```
Question: "Explain how neural networks work"
Model: microsoft/phi-4-reasoning-plus
Temperature: 0.3
System Prompt: "You are a technical expert who explains complex concepts clearly."
```

## Command Reference

### Perplexity Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `Ask Perplexity` | Query Perplexity AI with full configuration | Editor command with modal interface |
| `Enhance Selected Text with Perplexity` | Enhance selected text using Perplexity AI | Editor command with modal interface |
| `Update Perplexity URL` | Change Perplexity API endpoint | Settings command |
| `Show Perplexity Settings` | Display current Perplexity configuration | Debug command |

### Directory Template & Vault Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `Apply directory template to current file` | Fill, append to, or **remake** the active note. Offers model, retrieval, and output-mode choices | Palette command with run dialog |
| `Apply directory template to all files in folder` | Batch-run a template across a folder | Palette command with folder picker |
| `Stop directory template batch` | Halt a running batch after the current file | Palette command |
| `Check Exa service status` | Probe the Exa API with a real one-result query | Palette command |
| `Link back to vault notes` | Find unlinked mentions of other vault notes in the active file and convert them, behind a review table | Palette command with review modal |

**Output modes.** When the active note already has content, the run dialog offers three choices: *Append* below it (the default), *Remake* — rewrite it, passing the old draft to the model as explicitly-stale background after snapshotting to `Content-Dev/history/` — or *Replace*, discarding the old draft outright. Remake exists because a research note written in May is wrong by September; it instructs the model that current sources win on conflict and asks it to name the pivot explicitly.

### Google Gemini Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `Ask Gemini` | Query Google Gemini with Google Search grounding | Editor command with modal interface |
| `Check Gemini service status` | Report whether the service initialized and the API key is configured | Debug command |

### Perplexica / Vane Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `Ask Perplexica / Vane` | Query Perplexica / Vane with focus and optimization modes | Editor command with modal interface |
| `Update Perplexica / Vane URL` | Change Perplexica / Vane API endpoint | Settings command |
| `Show Perplexica / Vane Settings` | Display current Perplexica / Vane configuration | Debug command |

### LM Studio Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `Ask LM Studio` | Query local LM Studio with custom parameters | Editor command with modal interface |
| `Update LM Studio URL` | Change LM Studio API endpoint | Settings command |
| `Show LM Studio Settings` | Display current LM Studio configuration | Debug command |

### Keyboard Shortcuts

You can set custom keyboard shortcuts for any command:
1. Open Obsidian Settings → Hotkeys
2. Search for "Perplexed" commands
3. Assign your preferred shortcuts

---

## Directory Templates

**Per-folder content generation — one template fills a whole category of files.**

Originally specced as "prompt outlines"; the shipped paradigm is broader and is called *directory templates* throughout the code and command palette. Full reference: [`docs/directory-templates.md`](docs/directory-templates.md). Engineering changelog: [`changelog/2026-05-10_01.md`](changelog/2026-05-10_01.md).

### Why this exists

A working Obsidian vault collects categories of files that share a shape — concepts, vocabulary terms, sources, tooling profiles. Filling them out one editor-callback at a time is untenable when you have hundreds or thousands. A directory template is a single markdown file that says *"for any file under `concepts/**`, here is the structure to fill and the system prompt to use,"* and the runtime applies it to one file or a whole folder via Perplexity research with streaming writes.

### The three primitives

1. **Template** — a markdown file in `Content-Dev/Templates/` with frontmatter (`applies-to-paths` glob), a fenced `cft` config block (provider, model, return flags, system prompt with interpolation tokens like `{{basename}}` and `{{frontmatter.tags}}`), and a heading skeleton that becomes the user prompt. Everything below the first `***` divider is excluded from the request — it's your scratch space.
2. **Commands** — `Apply directory template to current file` auto-matches via the glob; `Apply directory template to folder` runs a batch with a confirmation modal; `Stop directory template batch` halts a running batch.
3. **Cleanup pipeline** — after the SSE stream completes, the runtime wraps `<think>` blocks, swaps `[IMAGE N: <description>]` markers for real embeds (with a fallback `# Images` section when the model didn't emit markers but Perplexity returned images), strips unreplaced placeholders, appends a `# Sources` footer in the format [cite-wide](https://github.com/lossless-group/cite-wide) can convert to hex citations, appends a separate `## Sources (retrieved)` footer when a retrieval stage ran, and stamps `cf_last_run` + `cf_last_run_model` into the target's frontmatter.

### Partials and preambles — shared guidance across templates

Two peer folders alongside `templates/` keep editorial rules vault-visible and DRY:

```
Content-Dev/
├── templates/         (your seven profile templates)
├── partials/          (reusable snippets included via {{include: name}})
│   ├── mermaid-discipline.md      (paired BAD/GOOD examples + 6-item self-check)
│   └── latex-discipline.md        (Obsidian MathJax delimiters + $ escaping)
└── preambles/         (auto-attached to every request as system / user messages)
    ├── inline-citation.md
    ├── image-placement.md
    ├── research-framing.md
    ├── spliced-source-citation.md  (attached only when retrieval returned sources)
    └── remake-framing.md           (attached only on a Remake run)
```

- **`{{include: name}}`** in a template body splices in `partials/name.md` recursively (depth-limited, cycle-detected). Missing files show as inline `[[include: name — file not found]]` markers so typos stay visible.
- **Preambles auto-attach** to every Perplexity request with bundled defaults as fallback. Settings tab exposes Partials root, Preambles root, System preambles (default: `inline-citation`), User preambles (default: `image-placement` when return-images is on).
- **Per-template overrides** in the `cft` fence: `preambles: { system: [...], skip-user: [...], skip-all: true }`.

Fix the mermaid quoting rule once in `partials/mermaid-discipline.md` and every future template generation picks it up — no template editing required.

### Shipped templates

Seven templates ship inlined into the plugin and seed into your vault on first plugin load:

| File | Targets | Use for |
|---|---|---|
| `concept-profile.md` | `concepts/**` | Encyclopedia-style entries on ideas, patterns, mental models. Anti-incumbent editorial stance baked in (tech giants treated as adopters/popularizers, not innovators, unless documented heyday-era origination supports otherwise). Includes both `mermaid-discipline` and `latex-discipline` partials. |
| `vocabulary-profile.md` | `Vocabulary/**` | Term definitions with disambiguation through an innovation-consulting lens. |
| `source-profile.md` | `Sources/**` | Profiles of books, people, channels, publications, journals, reports, events — type-aware, with Google Books URL harvesting for books. |
| `toolkit-profile.md` | `Tooling/**` | Profiles of tools, products, platforms, frameworks. |
| `market-map-profile.md` | `lost-in-public/market-maps/**`, `market-maps/**` | Analyst-grade market-map drafts — both Known Category (e.g., Humanoid Robots) and Thesis-Driven (e.g., Neural Network Hardware as Brains for Robotics). Runs on `sonar-deep-research` with idle-only timeout, `max-tokens: 24000`, and a 40-min absolute wall-clock ceiling. |
| `standards-and-specs-profile.md` | `Sources/Standards-and-Specs/**`, `Standards-and-Specs/**` | Analyst-grade profiles of open specs and standards. Five-way authority typing (de-jure / consortium / vendor-led-open / community / de-facto). Three-tier structural adoption framing (incumbents / challengers / innovators) plus notable holdouts. Named editors, stewardship transitions, named critics. |
| `market-category-profile.md` | `concepts/Market-Categories/**`, `Market-Categories/**` | Concept-folder reference card for a named market category. Three-tier company landscape with explicit FINANCIAL-STAGE definitions: Incumbents (public / late-stage private / PE-owned) → Challengers (Series C+ scale-ups, recently public) → Innovators (Pre-Seed through Series B). Separate Why Now / What's Happening sections covering CAGR + category-creation momentum. Industry Coverage sub-grouped into Market Reports / Industry Articles / Financial News. |

The first four templates use Perplexity's `sonar-pro`. The three deep-research templates (`market-map-profile`, `standards-and-specs-profile`, `market-category-profile`) use `sonar-deep-research` and declare per-template cft-block overrides for the wall-clock ceiling (`request-timeout-ms`), the per-chunk idle timer (`stream-idle-timeout-ms`), and the Perplexity output-token budget (`max-tokens: 24000`). See [`docs/directory-templates.md`](docs/directory-templates.md) for the full cft-block grammar and the diagnostic table for distinguishing wall-clock-timeout truncation from max_tokens truncation.

### Retrieval before generation — Exa

**Perplexity writes well and retrieves badly on companies. So it no longer does both jobs.**

Ask a grounded search model about NATS — the messaging system — and it will cite the UK's National Air Traffic Services. Ask about Kestra and you get a medical device maker and a financial advisory firm. The prose is excellent; the company is wrong.

[Exa](https://exa.ai/) is built for the other half of the job. Declare an `include-sources:` block in a template's `cft` fence and Exa runs **before** the writing model, finds the actual entity, and hands over structured facts it can trust.

```yaml
include-sources:
  - provider: exa
    query: "{{basename}} {{url}} overview product funding customers"
    category: company
    num-results: 6
    pin: entity
    contents:
      summary:
        query: "What does this do, founded when, funding raised, notable customers?"
        schema:
          type: object
          properties:
            founded_year: { type: string }
            funding: { type: string }
            notable_customers: { type: array, items: { type: string } }
```

What reaches the prompt:

```markdown
### [^E1] Synadia — https://nats.io/

founded_year: 2017
funding: USD 41,200,000 total funding across multiple rounds (Seed, Venture, Series B)
notable_customers: [NVIDIA, Mastercard, Rivian, Replit]
workforce: { total: 44 }
```

#### `pin:` is the precision knob

| Mode | Behaviour | Use for |
|---|---|---|
| `pin: entity` | Restricts the search to the target file's own `url:` domain | Profiling **one** company — `Tooling/**` |
| `pin: none` | Unpinned similarity search across the category | Enumerating **competitors** — market maps |

Unpinned, a NATS query returns Nstream, Element and Mio. That is wrong for a product profile and exactly right for a market map — the same knob, turned opposite ways.

> **Pin narrowly or not at all.** Exa matches `includeDomains` by *substring*, so pinning `cresta.com` also matches `alcresta.com` (a pharma company), `codecresta.com`, and `ridgecresta.com`. Perplexed re-checks every result against the real hostname, so impostors are dropped before they reach the prompt — but do not hand it broad domains like `github.com`, which will always surface something.

#### Retrieved sources get their own citation namespace

The writing model numbers its own web-search citations `[1]`, `[2]`. Retrieved sources are **not** in that array, so they are cited `[^E1]`, `[^E2]` and listed in a separate footer:

```markdown
## Sources (retrieved)

[^E1]: [Exa.ai](https://exa.ai) API response for data on [Datagrid AI](https://datagrid.com/)
```

If the two namespaces were merged, a fact retrieved from Exa would be footnoted to whatever the search model's third result happened to be — a note that looks perfectly well-cited and attributes claims to the wrong documents. The `[^E…]` form is a real Obsidian footnote, so hover-preview and click-to-jump work, and [cite-wide](https://github.com/lossless-group/cite-wide)'s spacing pass handles it unchanged.

#### Turning it on and off

- **Settings → Exa retrieval** — API key, endpoint, and a master switch. With it off, templates that declare `include-sources:` run as if Exa did not exist.
- **The run dialog** — a *Retrieve sources first (Exa)* toggle appears when the active template declares the key, so you can skip retrieval for a single run.
- **Failure is never fatal.** No key, rate limited, Exa unreachable — the run proceeds without the extra sources and posts a notice. A forty-minute deep-research run is never aborted because a retrieval provider had a bad minute.

#### What it costs

$7 per 1,000 searches and $1 per 1,000 pages per content type, so a typical profile is about **$0.023**. The free tier is $20 in signup credits plus $10 monthly, no credit card.

The real ceiling is **context**, not money: past roughly 12,000 characters of pasted source text the writing model's attention drifts off your section outline and onto the sources. Perplexed enforces a character budget (*Settings → Spliced context budget*), drops the lowest-ranked sources when it is exceeded, and leaves a visible marker saying how many — never a silent truncation.

`toolkit-profile.md` ships with retrieval enabled as the reference implementation.

### Auto-seed behavior

On first plugin load, Perplexed writes the four templates plus a user-facing `README.md` to `Content-Dev/Templates/` in your vault. The seeder uses a two-tier policy:

- **README** — always ensured present; if you delete it, the next plugin load writes it back.
- **Templates** — only seeded when the templates folder is missing or contains no non-README markdown. A folder with even one shipped template is treated as user-managed and left alone.

A **Re-seed templates** button in *Settings → Directory templates* writes any shipped file whose filename doesn't already exist — useful for pulling in a new template after a plugin update without overwriting your edits.

### Writing your own template

Copy any shipped template under a new filename, change the frontmatter (`title`, `description`, `applies-to-paths` glob), rewrite the `cft` block's `system:` prompt for your domain, and rewrite the heading skeleton with the structure you want. Save in `Content-Dev/Templates/`. The plugin picks it up on the next palette invocation — no reload needed.

For interpolation tokens, the full cft block grammar, the cleanup pipeline mechanics, the editorial stance rationale, frontmatter stamps, and known limits — see [`docs/directory-templates.md`](docs/directory-templates.md).

---

# Releases

**0.4.0** — 2026-10-06 · requires Obsidian 1.13

- Settings rebuilt on Obsidian 1.13's declarative API: every setting is searchable, and one broken row can no longer hide the rest of the tab.
- System preambles, user preambles, and the frontmatter whitelist are editable lists (add, delete, drag to reorder) instead of comma-separated text.
- Number fields reject values that would not work, instead of silently dropping the edit; Exa's key and endpoint appear only while Exa retrieval is on.
- Fixed: in a vault with no saved prompts, "Reset prompts to default" could restore your own edits instead of the defaults until Obsidian restarted.
- Full notes: [`changelog/releases/0.4.0.md`](changelog/releases/0.4.0.md).

**0.3.1** — 2026-07-06 · Perplexity streaming restored after a CORS change. [Notes](changelog/releases/0.3.1.md).

---

# Developer Onboarding

## Project Structure

```
perplexed-plugin/              # the folder name in your vault must be the plugin id: perplexed
├── main.ts                    # Plugin class: loads settings, wires services, registers commands
├── src/
│   ├── settings/              # Settings shape, defaults, and the declarative settings tab
│   ├── services/              # One service per provider (Perplexity, Claude, Gemini, ...), plus
│   │                          #   directory templates, Exa retrieval, vault linking, find images
│   ├── modals/                # The command dialogs
│   ├── docs/                  # Templates, partials, and preambles seeded into the vault
│   └── styles/                # CSS, bundled into styles.css
├── tests/                     # node:test specs, run against a stub of the obsidian module
├── scripts/run-tests.mjs      # Bundles and runs the tests (no test framework)
├── esbuild.config.mjs         # Builds main.js and styles.css
├── manifest.json              # Plugin id, version, minAppVersion
└── versions.json              # Plugin version -> minimum Obsidian version
```

## Development Setup

Requires Node.js 22 and pnpm.

```bash
git clone https://github.com/lossless-group/perplexed-plugin.git
cd perplexed-plugin
pnpm install
pnpm dev      # esbuild watch: rebuilds main.js and styles.css on change
pnpm test     # Node's built-in test runner; no network calls
pnpm build    # ESLint (Obsidian's review-bot rules) + tsc + production bundle
```

To use your working copy in a vault, symlink it into the vault's plugins folder. The link must be named after the plugin id, `perplexed`:

```bash
ln -s /path/to/perplexed-plugin /path/to/your-vault/.obsidian/plugins/perplexed
```

On Windows (PowerShell):

```powershell
New-Item -ItemType SymbolicLink -Path "C:\path\to\your-vault\.obsidian\plugins\perplexed" -Target "C:\path\to\perplexed-plugin"
```

Then run `pnpm dev`, and reload the plugin to pick up new builds: toggle it off and on in Community plugins, or quit and reopen Obsidian.

## Architecture Overview

- **`main.ts`**: the `PerplexedPlugin` class. `onload()` loads settings, seeds the shipped templates into the vault if the templates folder is empty, builds one service per provider, adds the settings tab, and registers the commands.
- **`src/settings/PerplexedSettings.ts`**: `PerplexedPluginSettings`, `DEFAULT_SETTINGS`, and `PerplexedSettingTab`. The tab implements `getSettingDefinitions()` (Obsidian 1.13+), so Obsidian draws and indexes the rows; there is no `display()`. Controls bind to dot-path keys such as `prompts.enhancePrompt` through `getControlValue` / `setControlValue`.
- **`src/services/`**: the provider services. Streaming Perplexity requests go through Node's `https` module rather than `fetch`, because Perplexity's API stopped sending the CORS headers Electron's renderer requires (see [0.3.1](changelog/releases/0.3.1.md)). Non-streaming requests use Obsidian's `request()` / `requestUrl()`.
- **`src/modals/`**: one dialog per command. Each takes the service it needs and the prompts service.

Provider services copy their API key and endpoint when they are built. After changing a key or endpoint in settings, run **Reinitialize provider services** (or reload the plugin).

## Contributing

1. Branch from `development`.
2. Keep `pnpm test`, `pnpm build` (ESLint with zero errors and zero warnings, plus `tsc`) green.
3. Settings: add the key to `PerplexedPluginSettings` and `DEFAULT_SETTINGS`, then a definition in `getSettingDefinitions()`. The settings tests check that every control key exists in `DEFAULT_SETTINGS`.
4. Commands: command IDs are what users bind hotkeys to. Never rename one; `tests/plugin-onload.test.ts` lists them all.
5. UI strings are sentence case (the review bot enforces it); product names are taught to the lint rule in `eslint.config.mjs`.

**Releasing.** Bump `manifest.json`, `package.json`, and `versions.json` together (three-part semver), write `changelog/releases/<version>.md`, and push a tag with no `v` prefix (for example `0.4.0`). `.github/workflows/release.yml` then builds, attests, and publishes the release with those notes.

## Troubleshooting

### Common Issues

1. **API Key Not Working**:
   - Verify API key is correct
   - Check API key permissions
   - Ensure endpoint URL is correct

2. **Network Errors**:
   - Check internet connection
   - Verify firewall settings
   - Test endpoint accessibility

3. **Plugin Not Loading**:
   - Check Obsidian console for errors
   - Verify plugin is enabled
   - Check for conflicting plugins

### Debug Mode

Enable debug logging by checking the browser console:
1. Open Obsidian
2. Press `Ctrl/Cmd + Shift + I` (Developer Tools)
3. Check Console tab for plugin logs

### Getting Help

- Check the [Issues](https://github.com/lossless-group/perplexed-plugin/issues) page
- Review the [Discussions](https://github.com/lossless-group/perplexed-plugin/discussions) forum
- Contact the development team

---

## About The Lossless Group

[The Lossless Group](https://lossless.group) is a loose collection of individuals and organizations interested in creating winning formulae for using AI and Collaborative Tooling. We consult, invest in startups, run Venture Capital Funds, host Hackathons, build products, write content, and contribute to open source projects.

We are committed to playing on the frontiers of technology and staying curious and engaged.

---

**License**: MIT  
**Author**: The Lossless Group  
**Support**: [GitHub Issues](https://github.com/lossless-group/perplexed-plugin/issues)
