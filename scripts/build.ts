/**
 * Build script for Obsidian plugin using esbuild.
 *
 * Usage:
 *   bun run scripts/build.ts              # Development build
 *   bun run scripts/build.ts --production # Production build (minified)
 */

import esbuild from "esbuild";

const isProduction = process.argv.includes("--production");

await esbuild.build({
	entryPoints: ["src/main.ts"],
	bundle: true,
	outfile: "main.js",
	platform: "node",
	format: "cjs",
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
	],
	minify: isProduction,
	sourcemap: isProduction ? false : "inline",
	treeShaking: true,
	logLevel: "info",
});
