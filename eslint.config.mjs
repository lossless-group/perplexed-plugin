import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
	{
		// tests/ and scripts/ are bundled by esbuild for node:test, not
		// shipped; the plugin lint rules don't apply to them.
		ignores: ["node_modules/", "main.js", "**/*.mjs", "test-*.sh", "tests/**", "scripts/**", ".test-build/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...tseslint.configs.strict,
	// Obsidian community-plugin rules — mirrors what ObsidianReviewBot
	// enforces server-side at submission time. Keep this enabled so
	// violations surface in `pnpm build`, not in the marketplace PR review.
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
				project: "./tsconfig.json",
			},
			globals: {
				...globals.node,
				...globals.browser,
			},
		},
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
			"@typescript-eslint/ban-ts-comment": "off",
			"no-prototype-builtins": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unnecessary-type-assertion": "error",
			"@typescript-eslint/no-floating-promises": "error",
			"@typescript-eslint/no-base-to-string": "error",
			"@typescript-eslint/no-misused-promises": "error",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/consistent-type-imports": "error",
			// Bot's exact ban: only warn / error / debug allowed.
			"no-console": ["error", { allow: ["warn", "error", "debug"] }],
			// Sentence-case UI text, with this plugin's vocabulary taught to the rule.
			//
			// NOTE: `brands` REPLACES the rule's built-in dictionary rather than
			// extending it (`options?.brands ?? DEFAULT_BRANDS` in sentenceCaseUtil).
			// So the list below is the upstream default set, reproduced, plus our
			// additions — dropping any entry silently un-teaches that brand.
			//
			// Two deliberate divergences from upstream:
			//
			// 1. ADDED the providers this plugin integrates. Upstream knows Claude,
			//    Gemini and Anthropic but not Perplexity, Perplexica, Vane, LM Studio,
			//    Sonar or Exa. Without them the rule flags real product names as
			//    violations, and appeasing it means shipping UI that reads "your local
			//    lm studio server". Product names are proper nouns: teach the rule,
			//    don't lowercase the product.
			//
			// 2. OMITTED "Cursor". Upstream lists it as the code editor, which makes
			//    the rule try to capitalize every mention of a text cursor into a
			//    brand. "Streams into the active note at the cursor" is correct
			//    English and stays lowercase. We never reference the editor.
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					brands: [
						// --- our additions ---
						"Perplexity", "Perplexica", "Vane", "LM Studio", "Exa",
						"OpenGraph", "ImageKit",
						// --- upstream DEFAULT_BRANDS, less "Cursor" (see note 2) ---
						"iOS", "iPadOS", "macOS", "Windows", "Android", "Linux",
						"Obsidian", "Obsidian Sync", "Obsidian Publish",
						"Google", "Gemini", "Vertex AI", "OpenAI", "GPT",
						"Anthropic", "Claude", "Microsoft", "Google Drive",
						"Dropbox", "OneDrive", "iCloud Drive", "YouTube", "Slack",
						"Discord", "Telegram", "WhatsApp", "Twitter", "X",
						"Readwise", "Zotero", "Excalidraw", "Mermaid", "Markdown",
						"LaTeX", "JavaScript", "TypeScript", "Node.js", "npm",
						"pnpm", "Yarn", "Git", "GitHub", "GitLab", "Anki",
						"CalDAV", "CardDAV", "Evernote", "IntelliJ IDEA", "Jekyll",
						"Logseq", "Notion", "PyCharm", "React", "Reddit",
						"Roam Research", "Svelte", "VS Code", "Visual Studio Code",
						"WebDAV", "WebStorm",
					],
					// URL-shaped strings are skipped whole: the tokenizer happily
					// "corrects" api.perplexity.ai into api.Perplexity.ai, which
					// silently corrupts an endpoint shown to the user.
					//
					// "Sonar" is deliberately NOT a brand above — it only ever appears
					// inside lowercase model IDs (sonar-pro, sonar-deep-research), and
					// listing it rewrites those to Sonar-pro.
					ignoreRegex: ["^[A-Za-z]+://"],
					allowAutoFix: true,
				},
			],
		},
	},
);
