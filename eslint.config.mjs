import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
	{
		ignores: ["node_modules/", "main.js", "**/*.mjs", "test-*.sh"],
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
		},
	},
);
