/**
 * Manual stress test runner to measure performance of the full sync workflow.
 *
 * Usage: source test-integration/.env.test && bun run test-integration/scripts/run-stress-test.ts
 *
 * @module
 */

import { Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { toMarkdown } from "../../src/formatters/markdown.js";
import { AnnotationSyncer } from "../../src/services/AnnotationSyncer.js";
import { KavitaClient } from "../../src/services/KavitaClient.js";
import { ObsidianAdapter } from "../../src/services/ObsidianAdapter.js";
import { PluginConfig } from "../../src/services/PluginConfig.js";

const KAVITA_URL = process.env.KAVITA_URL ?? "http://localhost:5000";
const KAVITA_API_KEY = process.env.KAVITA_API_KEY ?? "";

if (!KAVITA_API_KEY) {
	console.error(
		"KAVITA_API_KEY not set. Source test-integration/.env.test first.",
	);
	process.exit(1);
}

const TestConfigLayer = Layer.succeed(
	PluginConfig,
	PluginConfig.of({
		kavitaUrl: new URL(KAVITA_URL),
		kavitaApiKey: Redacted.make(KAVITA_API_KEY),
		outputPath: "stress-test-output.md",
		matchThreshold: 0.7,
		includeComments: true,
		includeSpoilers: true,
		includeTags: true,
		tagPrefix: "kavita/",
		includeWikilinks: true,
		exportMode: "single-file",
		rootFolderName: "Kavita Annotations",
		deleteOrphanedFiles: true,
		annotationTemplate: "",
	}),
);

const KavitaClientLayer = KavitaClient.layerNoDeps.pipe(
	Layer.provide(TestConfigLayer),
	Layer.provide(FetchHttpClient.layer),
);

/** Mock ObsidianAdapter that collects writes in memory */
const createMockObsidianAdapter = () => {
	const writes: Array<{ path: string; content: string }> = [];

	const adapter = {
		writeFile: (path: string, content: string) =>
			Effect.sync(() => {
				writes.push({ path, content });
			}),
		appendToFile: () => Effect.void,
		readFile: () => Effect.succeed(""),
		getFile: () => Effect.succeed(Option.none()),
		listMarkdownFiles: Effect.succeed([]),
	};

	return {
		layer: Layer.succeed(
			ObsidianAdapter,
			adapter as unknown as typeof ObsidianAdapter.Service,
		),
		getWrites: () => writes,
	};
};

const runStressTest = Effect.gen(function* () {
	const client = yield* KavitaClient;

	console.log(`\n${"=".repeat(60)}`);
	console.log("📊 KAVITA-TO-OBSIDIAN STRESS TEST (10,000 annotations)");
	console.log("=".repeat(60));

	/** Test 1: Fetch annotations */
	console.log("\n🔍 Test 1: Fetching annotations...");
	const fetchStart = Date.now();
	const annotations = yield* client.fetchAllAnnotations;
	const fetchTime = Date.now() - fetchStart;

	console.log(
		`   ✓ Fetched ${annotations.length} annotations in ${fetchTime}ms`,
	);
	console.log(
		`   ✓ Rate: ${((annotations.length / fetchTime) * 1000).toFixed(0)} annotations/second`,
	);

	if (annotations.length < 10_000) {
		console.log(
			`   ⚠️ Expected 10,000+ annotations but got ${annotations.length}`,
		);
	}

	/** Test 2: Format annotations to markdown */
	console.log("\n📝 Test 2: Formatting annotations to markdown...");
	const formatStart = Date.now();
	const markdown = toMarkdown(annotations, {
		includeComments: true,
		includeSpoilers: true,
		includeTags: true,
		tagPrefix: "kavita/",
		includeWikilinks: true,
	});
	const formatTime = Date.now() - formatStart;

	console.log(`   ✓ Generated markdown in ${formatTime}ms`);
	console.log(`   ✓ Output size: ${(markdown.length / 1024).toFixed(1)} KB`);
	console.log(`   ✓ Lines: ${markdown.split("\n").length}`);

	/** Test 3: Full sync workflow */
	console.log("\n🔄 Test 3: Full sync workflow...");
	const mockAdapter = createMockObsidianAdapter();

	const SyncerLayer = AnnotationSyncer.layerNoDeps.pipe(
		Layer.provide(KavitaClientLayer),
		Layer.provide(mockAdapter.layer),
		Layer.provide(TestConfigLayer),
	);

	const syncStart = Date.now();
	const result = yield* Effect.gen(function* () {
		const syncer = yield* AnnotationSyncer;
		return yield* syncer.syncToFile;
	}).pipe(Effect.provide(SyncerLayer));
	const syncTime = Date.now() - syncStart;

	const writes = mockAdapter.getWrites();
	const totalBytes = writes.reduce((sum, w) => sum + w.content.length, 0);

	console.log(`   ✓ Sync completed in ${syncTime}ms`);
	console.log(`   ✓ Annotations synced: ${result.count}`);
	console.log(`   ✓ Files written: ${writes.length}`);
	console.log(`   ✓ Total output: ${(totalBytes / 1024).toFixed(1)} KB`);

	/** Summary */
	console.log(`\n${"=".repeat(60)}`);
	console.log("📈 PERFORMANCE SUMMARY");
	console.log("=".repeat(60));
	console.log(
		`   Fetch:  ${fetchTime}ms (${((annotations.length / fetchTime) * 1000).toFixed(0)} annotations/sec)`,
	);
	console.log(`   Format: ${formatTime}ms`);
	console.log(`   Sync:   ${syncTime}ms (includes fetch + format + metadata)`);
	console.log(`   Total annotations: ${annotations.length}`);
	console.log(`   Output size: ${(totalBytes / 1024).toFixed(1)} KB`);

	/** Performance assertions */
	const passed = fetchTime < 30_000 && formatTime < 5_000 && syncTime < 60_000;
	console.log(
		"\n" +
			(passed
				? "✅ All performance budgets met!"
				: "❌ Some performance budgets exceeded"),
	);

	return passed;
});

const program = runStressTest.pipe(Effect.provide(KavitaClientLayer));

Effect.runPromise(program)
	.then((passed) => {
		process.exit(passed ? 0 : 1);
	})
	.catch((error) => {
		console.error("Stress test failed:", error);
		process.exit(1);
	});
