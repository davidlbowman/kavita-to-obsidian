import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	{
		ignores: [
			"node_modules/**",
			"dist/**",
			"**/*.test.ts",
			"test-integration/**",
			"__mocks__/**",
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
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
	},
]);
