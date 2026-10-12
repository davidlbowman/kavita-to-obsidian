import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
	{
		ignores: [
			"node_modules/**",
			"**/*.test.ts",
			"**/__mocks__/**",
			"test-integration/**",
			"test-support/**",
			"scripts/**",
			"coverage/**",
			"main.js",
			"*.config.ts",
			"*.config.mjs",
		],
	},
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parserOptions: { projectService: true },
			globals: globals.browser,
		},
		rules: {
			"obsidianmd/ui/sentence-case": [
				"warn",
				{ brands: ["Kavita", "Bases"], enforceCamelCaseLower: true },
			],
		},
	},
]);
