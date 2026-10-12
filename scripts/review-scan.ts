/**
 * Approximate the Obsidian community review locally before asking for a
 * real review.
 *
 * 1. Lints the whole repository with eslint-plugin-obsidianmd's recommended
 *    rules, like the review does (it scans test code too, but skips
 *    `*.test.ts`, any `scripts/` folder, and config files).
 * 2. Builds `main.js` and reports APIs the review discloses or flags:
 *    vault enumeration, base64 (`atob`/`btoa`), network calls, `eval`.
 * 3. Audits dependencies with `bun audit`.
 *
 * Usage: bun run review:scan
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { ESLint } from "eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

const FLAGGED_IN_BUNDLE: ReadonlyArray<readonly [string, RegExp]> = [
	[
		"vault enumeration",
		/\b(getMarkdownFiles|getFiles|getAllLoadedFiles|getAllFolders)\(/g,
	],
	["base64 (atob/btoa)", /\b(atob|btoa)\(/g],
	["fetch", /\bfetch\(/g],
	["XMLHttpRequest", /\bXMLHttpRequest\b/g],
	["eval / new Function", /\beval\(|new Function\(/g],
	["innerHTML", /\binnerHTML\b/g],
];

const run = (command: string, args: ReadonlyArray<string>) =>
	spawnSync(command, args, { encoding: "utf8" });

const eslint = new ESLint({
	overrideConfigFile: true,
	overrideConfig: [
		{
			ignores: [
				"node_modules/**",
				"**/*.test.ts",
				"**/scripts/**",
				"*.config.*",
				"main.js",
				"coverage/**",
			],
		},
		...obsidianmd.configs.recommended,
		{
			files: ["**/*.ts"],
			languageOptions: { parserOptions: { projectService: true } },
			rules: {
				"obsidianmd/ui/sentence-case": [
					"warn",
					{ brands: ["Kavita", "Bases"], enforceCamelCaseLower: true },
				],
			},
		},
	],
});

let problems = 0;

console.log("1. Review lint (whole repository)");
const results = await eslint.lintFiles([
	"src",
	"test-integration",
	"test-support",
]);
for (const result of results) {
	for (const message of result.messages) {
		if (message.ruleId === "no-undef") continue;
		problems++;
		console.log(
			`   ${result.filePath.replace(`${process.cwd()}/`, "")}:${message.line}  ${message.message}  (${message.ruleId ?? "parse"})`,
		);
	}
}
if (problems === 0) console.log("   clean");

console.log("2. Bundle (main.js)");
const build = run("bun", ["run", "build"]);
if (build.status !== 0) {
	console.log(build.stdout, build.stderr);
	process.exit(1);
}
const bundle = readFileSync("main.js", "utf8");
for (const [label, pattern] of FLAGGED_IN_BUNDLE) {
	const count = bundle.match(pattern)?.length ?? 0;
	if (count > 0) problems++;
	console.log(
		`   ${label.padEnd(22)} ${count === 0 ? "none" : `${count} found`}`,
	);
}
const network = bundle.match(/\brequestUrl\)?\(/g)?.length ?? 0;
console.log(`   requestUrl calls       ${network} (disclosed in the README)`);

console.log("3. Dependencies");
const audit = run("bun", ["audit"]);
const clean = /No vulnerabilities found/.test(audit.stdout);
if (!clean) problems++;
console.log(clean ? "   no known vulnerabilities" : audit.stdout);

console.log(
	problems === 0 ? "\nReady for review." : `\n${problems} issue(s) to fix.`,
);
process.exit(problems === 0 ? 0 : 1);
