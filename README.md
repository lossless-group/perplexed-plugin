![Perplexed: An Obsidian Plugin for Perplexity and Perplexica](https://i.imgur.com/MVOK3rk.png)
# Perplexed: AI Content Generation for Obsidian

**Perplexed** is an Obsidian plugin that enables AI-powered content generation with source citations using [Perplexity](https://www.perplexity.ai/) and [Perplexica](https://perplexica.io/). This plugin brings research-grade AI capabilities directly into your Obsidian workspace, allowing you to generate well-cited content for your notes.

## 🎯 Key Features

- **Source-Cited AI Responses**: Get AI-generated content with proper citations and references
   - Default format:
   > ```markdown
    ### Citations

[1]: 2024, Dec 13. [What is GRC (Governance, Risk and Compliance) - Metricstream](https://www.metricstream.com/learn/what-is-grc.html). Published: 2024-05-01 | Updated: 2024-12-13

[2]: 2025, Jun 16. [Governance, risk and compliance (GRC): Definitions and resources](https://www.diligent.com/resources/guides/grc). Published: 2025-05-27 | Updated: 2025-06-16
   > ```

- **Multiple AI Providers**: Support for Perplexity (commercial) and Perplexica (self-hosted)
- **Streaming Responses**: Real-time streaming of AI responses for better UX
- **Flexible Configuration**: Customizable endpoints, models, and parameters
- **Deep Research Mode**: Comprehensive research across hundreds of sources
- **Local LLM Support**: Integration with LM Studio for local AI processing

## 📋 Table of Contents

- [User Onboarding](#user-onboarding)
  - [Installation](#installation)
  - [Initial Setup](#initial-setup)
  - [Using Perplexity](#using-perplexity)
  - [Using Perplexica](#using-perplexica)
  - [Using LM Studio](#using-lm-studio)
  - [Command Reference](#command-reference)
- [Developer Onboarding](#developer-onboarding)
  - [Project Structure](#project-structure)
  - [Development Setup](#development-setup)
  - [Architecture Overview](#architecture-overview)
  - [Contributing](#contributing)

---

# User Onboarding

## Installation

1. **Download the Plugin**: 
   - Download the latest release from the releases page
   - Extract the ZIP file to your Obsidian plugins folder

2. **Enable in Obsidian**:
   - Open Obsidian Settings → Community Plugins
   - Turn off Safe Mode
   - Click "Install plugin from file"
   - Select the extracted plugin folder
   - Enable the "Perplexed" plugin

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

### 2. Configure Perplexica (Self-hosted alternative)

Perplexica is a free, open-source alternative that you can host yourself.

1. **Set up Perplexica Server**:
   - Follow the [Perplexica setup guide](https://perplexica.io/)
   - Ensure your server is running and accessible

2. **Configure in Plugin**:
   - Open plugin settings
   - Set the Perplexica endpoint (e.g., `http://localhost:3030/api/search`)
   - Configure your preferred model and settings

### 3. Configure LM Studio (Optional)

For local AI processing without internet dependency:

1. **Install LM Studio**:
   - Download from [LM Studio](https://lmstudio.ai/)
   - Install and start the application

2. **Configure in Plugin**:
   - Set LM Studio endpoint: `http://localhost:1234/v1/chat/completions`
   - Choose your preferred local model

## Using Perplexity

### Quick Start

1. **Open Command Palette**: `Ctrl/Cmd + Shift + P`
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
2. **Open Command Palette**: `Ctrl/Cmd + Shift + P`
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

## Using Perplexica

### Quick Start

1. **Open Command Palette**: `Ctrl/Cmd + Shift + P`
2. **Run Command**: Type "Ask Perplexica" and select it
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

1. **Open Command Palette**: `Ctrl/Cmd + Shift + P`
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

### Perplexica Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `Ask Perplexica` | Query Perplexica with focus and optimization modes | Editor command with modal interface |
| `Update Perplexica URL` | Change Perplexica API endpoint | Settings command |
| `Show Perplexica Settings` | Display current Perplexica configuration | Debug command |

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

# Developer Onboarding

## Project Structure

```
perplexed-plugin/
├── main.ts                 # Main plugin file with all functionality
├── manifest.json           # Plugin metadata and requirements
├── package.json            # Dependencies and build scripts
├── esbuild.config.mjs      # Build configuration
├── tsconfig.json           # TypeScript configuration
├── styles.css              # Plugin styles (if any)
└── README.md              # This file
```

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- pnpm (recommended) or npm
- Obsidian desktop application
- Git

### Installation

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd perplexed-plugin
   ```

2. **Install Dependencies**:
   ```bash
pnpm install
   ```

3. **Build the Plugin**:
   ```bash
pnpm build
   ```

4. **Development Mode**:
   ```bash
pnpm dev
```

### Testing Your Plugin

1. **Create Symbolic Link** (macOS/Linux):
   ```bash
   ln -s /path/to/your/plugin /path/to/obsidian/vault/.obsidian/plugins/perplexed
   ```

2. **Windows (PowerShell)**:
   ```powershell
   New-Item -ItemType SymbolicLink -Path "C:\path\to\obsidian\vault\.obsidian\plugins\perplexed" -Target "C:\path\to\your\plugin"
   ```

3. **Enable in Obsidian**:
   - Open Obsidian Settings → Community Plugins
   - Disable Safe Mode
   - Enable the "Perplexed" plugin

## Architecture Overview

### Core Components

1. **PerplexedPlugin Class** (`main.ts`):
   - Main plugin class extending Obsidian's Plugin
   - Manages settings, commands, and UI components
   - Handles API interactions with all providers

2. **Settings Management**:
   - `PerplexedPluginSettings` interface defines all configurable options
   - `PerplexedSettingTab` provides the settings UI
   - Settings are persisted using Obsidian's data API

3. **Command Registration**:
   - `registerPerplexityCommands()`: Perplexity-specific commands
   - `registerPerplexicaCommands()`: Perplexica-specific commands
   - `registerLMStudioCommands()`: LM Studio-specific commands

4. **API Integration**:
   - `queryPerplexity()`: Handles Perplexity API calls
   - `queryPerplexica()`: Handles Perplexica API calls
   - `queryLMStudio()`: Handles LM Studio API calls

### Key Features Implementation

#### Streaming Responses
```typescript
// Example from queryPerplexity method
if (useStreaming) {
    const reader = response.body?.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        // Process and display chunk in real-time
    }
}
```

#### Modal Interfaces
Each command uses Obsidian's Modal class to create user-friendly input forms:
```typescript
const modal = new (class extends Modal {
    private queryInput!: HTMLTextAreaElement;
    
    onOpen() {
        // Create form elements
    }
    
    async onSubmit() {
        // Handle form submission
    }
})(this.app, this, editor);
```

#### Error Handling
Comprehensive error handling for API failures, network issues, and invalid configurations:
```typescript
try {
    const response = await fetch(endpoint, options);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
} catch (error) {
    new Notice(`Error: ${error.message}`);
    console.error('API Error:', error);
}
```

### Configuration Management

The plugin supports extensive configuration through the settings interface:

```typescript
interface PerplexedPluginSettings {
    perplexityApiKey: string;
    perplexityEndpoint: string;
    perplexicaEndpoint: string;
    lmStudioEndpoint: string;
    defaultModel: string;
    defaultOptimizationMode: string;
    defaultFocusMode: string;
    // ... additional settings
}
```

### Build System

The project uses esbuild for fast compilation:

```javascript
// esbuild.config.mjs
import esbuild from 'esbuild';
import process from 'process';
import builtins from 'builtin-modules';

const banner =
`/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = (process.argv[2] === 'production');

esbuild.build({
    banner: {
        js: banner,
    },
    entryPoints: ['main.ts'],
    bundle: true,
    external: [
        'obsidian',
        'electron',
        '@codemirror/autocomplete',
        '@codemirror/collab',
        '@codemirror/commands',
        '@codemirror/language',
        '@codemirror/lint',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
        '@lezer/highlight',
        '@lezer/lr',
        ...builtins],
    format: 'cjs',
    watch: !prod,
    target: 'es2018',
    logLevel: "info",
    sourcemap: prod ? false : 'inline',
    treeShaking: true,
    outfile: 'main.js',
}).catch(() => process.exit(1));
```

## Contributing

### Development Workflow

1. **Create Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**:
   - Follow TypeScript best practices
   - Add proper error handling
   - Include JSDoc comments for public methods

3. **Test Your Changes**:
```bash
   pnpm build
   # Test in Obsidian
   ```

4. **Submit Pull Request**:
   - Include clear description of changes
   - Add tests if applicable
   - Update documentation

### Code Style Guidelines

- Use TypeScript strict mode
- Follow Obsidian plugin conventions
- Use async/await for API calls
- Implement proper error handling
- Add JSDoc comments for public APIs

### Testing

Currently, testing is manual through Obsidian. To test:

1. Build the plugin: `pnpm build`
2. Enable in Obsidian
3. Test all commands and settings
4. Verify error handling with invalid configurations

### Common Development Tasks

#### Adding a New AI Provider

1. **Add Settings**:
   ```typescript
   interface PerplexedPluginSettings {
       newProviderEndpoint: string;
       newProviderApiKey: string;
       // ... other settings
   }
   ```

2. **Add Query Method**:
   ```typescript
   public async queryNewProvider(query: string, options: any): Promise<void> {
       // Implementation
   }
   ```

3. **Register Commands**:
   ```typescript
   private registerNewProviderCommands(): void {
       this.addCommand({
           id: 'ask-new-provider',
           name: 'Ask New Provider',
           editorCallback: (editor: Editor) => {
               // Modal implementation
           }
       });
   }
   ```

4. **Update Settings UI**:
   Add configuration options to `PerplexedSettingTab.display()`

#### Modifying Response Format

The plugin inserts responses directly into the editor. To modify the format:

```typescript
// In query methods, modify the headerText
const headerText = `\n\n***\n## Custom Header\n**Question:** ${query}\n\n### **Response**:\n\n`;
```

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

- Check the [Issues](https://github.com/your-repo/issues) page
- Review the [Discussions](https://github.com/your-repo/discussions) forum
- Contact the development team

---

## About The Lossless Group

[The Lossless Group](https://lossless.group) is a loose collection of individuals and organizations interested in creating winning formulae for using AI and Collaborative Tooling. We consult, invest in startups, run Venture Capital Funds, host Hackathons, build products, write content, and contribute to open source projects.

We are committed to playing on the frontiers of technology and staying curious and engaged.

---

**License**: MIT  
**Version**: 0.0.0.1  
**Author**: The Lossless Group  
**Support**: [GitHub Issues](https://github.com/your-repo/issues)
