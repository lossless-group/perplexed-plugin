# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Repository Overview

**Perplexed** is an Obsidian plugin for AI-powered content generation with source citations. It integrates with Perplexity (commercial), Perplexica (self-hosted), and LM Studio (local) to generate research-grade content directly in Obsidian notes.

## Common Commands

### Development
```bash
# Install dependencies
pnpm install

# Development mode with watch (auto-rebuilds on changes)
pnpm dev

# Production build
pnpm build

# Type check without emitting
tsc -noEmit -skipLibCheck
```

### Testing
```bash
# Test Perplexity API (streaming)
./test-perplexity-api.sh

# Test Perplexity API (non-streaming)
./test-perplexity-non-streaming.sh
```

### Version Management
```bash
# Bump version (updates manifest.json and versions.json)
pnpm version
```

### Obsidian Development Setup
```bash
# Create symbolic link to Obsidian plugins folder (macOS/Linux)
ln -s $(pwd) /path/to/obsidian/vault/.obsidian/plugins/perplexed

# Windows (PowerShell)
New-Item -ItemType SymbolicLink -Path "C:\path\to\vault\.obsidian\plugins\perplexed" -Target "C:\path\to\perplexed"
```

## Architecture

### File Structure

**Core Files**:
- `main.ts` - Plugin entry point with all command registration and API logic (64KB monolithic file)
- `manifest.json` - Plugin metadata for Obsidian
- `styles.css` - Plugin UI styles (generated from `src/styles/main.css`)

**Source Organization** (`src/`):
- `modals/` - Modal UI components for user input
- `services/` - API integration services (Perplexity, Perplexica, LM Studio)
- `types/` - TypeScript type definitions
- `utils/` - Utility functions
- `styles/` - CSS source files
- `docs/` - Additional documentation

**Build Configuration**:
- `esbuild.config.mjs` - Build system (bundles TypeScript → JavaScript)
- `tsconfig.json` - TypeScript compiler configuration (strict mode)
- `.eslintrc` - Code quality rules

### Key Patterns

**1. Monolithic Main File**
The entire plugin logic lives in `main.ts` (64KB). All commands, API calls, modals, and settings are in a single `PerplexedPlugin` class.

**2. Command Registration**
Three provider-specific command registration methods:
- `registerPerplexityCommands()` - Perplexity commercial API
- `registerPerplexicaCommands()` - Self-hosted Perplexica
- `registerLMStudioCommands()` - Local LM Studio

**3. Modal-Based UI**
Each command creates an Obsidian Modal with configuration options (model selection, streaming toggle, etc.)

**4. Streaming Responses**
Uses `fetch` with streaming to display AI responses in real-time via `response.body.getReader()`

**5. Settings Persistence**
Settings stored via Obsidian's `loadData()`/`saveData()` API

### Build System

**esbuild** configuration:
- Target: ES2022
- Format: CommonJS (required by Obsidian)
- Bundle: Single `main.js` output
- External: Obsidian API, Electron, CodeMirror
- CSS: Separate build from `src/styles/main.css` → `styles.css`
- Dev mode: Watch mode with inline sourcemaps
- Production: Minified, no sourcemaps

### TypeScript Configuration

Extremely strict TypeScript settings enabled:
- `strict: true` with all sub-flags
- `noUnusedLocals`, `noUnusedParameters`
- `exactOptionalPropertyTypes`
- `noImplicitReturns`
- `noUncheckedIndexedAccess`

## API Integrations

### Perplexity
- Endpoint: `https://api.perplexity.ai/chat/completions`
- Models: `sonar-pro`, `sonar-small`, `sonar-deep-research`, etc.
- Features: Citations, images, related questions, recency filters
- Streaming: Supported via SSE

### Perplexica
- Default endpoint: `http://localhost:3030/api/search`
- Focus modes: webSearch, academicSearch, writingAssistant, wolframAlpha, etc.
- Optimization: speed, balanced, quality
- Streaming: Supported

### LM Studio
- Default endpoint: `http://localhost:1234/v1/chat/completions`
- Local model support (e.g., `ibm/granite-3.2-8b`, `microsoft/phi-4-reasoning-plus`)
- Custom system prompts, temperature, max tokens

## Development Workflow

1. **Make changes** to `main.ts` or files in `src/`
2. **Build** (dev watch mode auto-rebuilds): `pnpm dev`
3. **Test in Obsidian**: Reload plugin or restart Obsidian
4. **Check console**: `Cmd/Ctrl + Shift + I` for errors
5. **Iterate**: Edit → auto-rebuild → test

## Important Notes

- **Monolithic architecture**: All logic in `main.ts` - no module splitting
- **Obsidian API**: External dependency, not bundled
- **No automated tests**: Manual testing in Obsidian required
- **Desktop only**: Plugin marked as `isDesktopOnly: true` in manifest
- **ESLint configured**: Use `eslint` for linting (config in `.eslintrc`)
- **Strict TypeScript**: Code must satisfy very strict type checking
- **CSS build**: CSS is built separately then imported as text in main bundle
