# Perplexed: AI Content Generation for Perplexity and Perplexica for Obsidian

Generating content with AI is a skill unto itself, a new literacy even. To stay rigorous, we should use LLMs that _use quality sources_, and _cite sources_ as we would expect any research oriented authors and academics to do.

 Perplexed is a plugin for Obsidian that allows you to generate content with [Perplexity](https://www.perplexity.ai/) and [Perplexica](https://perplexica.io/).
 
[Perplexity](https://www.perplexity.ai/) is a commercial AI model vendor that charges for its API services and has a fancy AI Workspace. 

[Perplexica](https://perplexica.io/) is an open source alternative to Perplexity. It's free to use but requires that you host it yourself (and involves some fun setup steps that many would rather avoid).
 
 As of now (July 2025), these are the only widely used AI Model APIs that seem to cite sources. 


## Settings

Perplexed Plugin Settings
├── Perplexity (Remote Service) [PURPLE HEADER]
│   ├── Endpoint
│   ├── API Key
│   └── Request Body Template [PERPLEXITY JSON]
└── Perplexica (Self-Hosted) [PURPLE HEADER]
    ├── Endpoint
    ├── Fallback Container Path
    ├── Default Model
    └── Request Body Template [PERPLEXICA JSON]

## Getting Started

```
pnpm install
pnpm add -D esbuild @types/node builtin-modules
pnpm build
pnpm dev
```

## Packages, Dependencies, Libraries:

```json
"devDependencies": {
   "@types/node": "^24.0.12",
   "@typescript-eslint/eslint-plugin": "8.36.0",
   "@typescript-eslint/parser": "8.36.0",
   "builtin-modules": "5.0.0",
   "esbuild": "0.25.6",
   "eslint": "^9.30.1",
   "obsidian": "latest",
   "tslib": "2.8.1",
   "typescript": "5.8.3"
},
"dependencies": {
   "@modelcontextprotocol/sdk": "^1.15.0",
   "fastify": "^5.4.0",
   "zod": "^4.0.0"
}
```

## Using Symbolic Links to Test Your Plugin

If you're like us, you have a directory housing all your code projects. To use your plugin as you develop it, just create a symbolic link. Here is my example, but you will need to use your own path structure:

```bash
ln -s /Users/mpstaton/code/lossless-monorepo/obsidian-plugin-starter /Users/mpstaton/content-md/lossless/.obsidian/plugins/
```

# On The Lossless Group
[The Lossless Group](https://lossless.group) is a loose collection of individuals and organizations that are interested in creating winning formulae for using AI and Collaborative Tooling. 

We consult at times, invest in startups, run Venture Capital Funds, host Hackathons, build products, write or create content, and contribute to or sponsor open source projects.

First and foremost, we are friends that stay curious and engaged. We are committed to playing on the frontiers of technology, and we eat too many tacos. 

