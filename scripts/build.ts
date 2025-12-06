/**
 * Build script for Obsidian plugin using Bun's bundler.
 *
 * Usage:
 *   bun run scripts/build.ts              # Development build
 *   bun run scripts/build.ts --production # Production build (minified)
 */

const isProduction = process.argv.includes("--production");

const result = await Bun.build({
	entrypoints: ["src/main.ts"],
	outdir: ".",
	naming: "main.js",
	target: "node",
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
	sourcemap: isProduction ? "none" : "inline",
});

if (!result.success) {
	console.error("Build failed:");
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

console.log(
	`Build complete: main.js (${isProduction ? "production" : "development"})`,
);
