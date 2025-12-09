/**
 * Stress tests for Kavita sync with 10,000 annotations.
 *
 * These tests measure performance against a large dataset.
 * Run `bun run integration:stress` first to set up the data.
 *
 * @module
 */
import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import type { AnnotationDto } from "../src/schemas.js";
import { AnnotationSyncer } from "../src/services/AnnotationSyncer.js";
import { KavitaClient } from "../src/services/KavitaClient.js";
import { ObsidianAdapter } from "../src/services/ObsidianAdapter.js";
import { PluginConfig } from "../src/services/PluginConfig.js";

const KAVITA_URL = process.env.KAVITA_URL ?? "http://localhost:5000";
const KAVITA_API_KEY = process.env.KAVITA_API_KEY ?? "";

const TestConfigLayer = Layer.succeed(
	PluginConfig,
	new PluginConfig({
		kavitaUrl: new URL(KAVITA_URL),
		kavitaApiKey: Redacted.make(KAVITA_API_KEY),
		outputPath: "stress-test-output.md",
		matchThreshold: 0.7,
		includeComments: true,
		includeSpoilers: true,
		includeTags: true,
		tagPrefix: "kavita/",
		includeWikilinks: true,
	}),
);

const KavitaClientLayer = KavitaClient.DefaultWithoutDependencies.pipe(
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

describe("Kavita Stress Test (10,000 annotations)", () => {
	it.effect.skip("fetches 10,000 annotations within performance budget", () =>
		Effect.gen(function* () {
			const client = yield* KavitaClient;

			const startTime = Date.now();
			const annotations = yield* client.fetchAllAnnotations;
			const fetchTime = Date.now() - startTime;

			/** Performance: ${annotations.length} annotations in ${fetchTime}ms */

			expect(annotations.length).toBeGreaterThanOrEqual(10_000);
			expect(fetchTime).toBeLessThan(30_000); // Should complete within 30 seconds
		}).pipe(Effect.provide(KavitaClientLayer)),
	);

	it.effect.skip("generates markdown for 10,000 annotations efficiently", () =>
		Effect.gen(function* () {
			const client = yield* KavitaClient;

			const annotations = yield* client.fetchAllAnnotations;
			const stressAnnotations = annotations.filter((a) =>
				a.seriesName?.includes("Stress"),
			);

			/** Filtering: ${stressAnnotations.length} of ${annotations.length} annotations */

			expect(stressAnnotations.length).toBeGreaterThanOrEqual(10_000);

			const { toMarkdown } = yield* Effect.promise(
				() => import("../src/formatters/markdown.js"),
			);

			const startTime = Date.now();
			const markdown = toMarkdown(
				stressAnnotations as readonly AnnotationDto[],
				{
					includeComments: true,
					includeSpoilers: true,
					includeTags: true,
					tagPrefix: "kavita/",
					includeWikilinks: true,
				},
			);
			const formatTime = Date.now() - startTime;

			/** Markdown: ${formatTime}ms, ${(markdown.length / 1024).toFixed(1)} KB */

			expect(formatTime).toBeLessThan(5_000); // Should format within 5 seconds
			expect(markdown.length).toBeGreaterThan(0);
		}).pipe(Effect.provide(KavitaClientLayer)),
	);

	it.effect.skip("full sync completes within performance budget", () =>
		Effect.gen(function* () {
			const mockAdapter = createMockObsidianAdapter();

			const SyncerLayer = AnnotationSyncer.Default.pipe(
				Layer.provide(KavitaClientLayer),
				Layer.provide(mockAdapter.layer),
				Layer.provide(TestConfigLayer),
			);

			const syncer = yield* AnnotationSyncer.pipe(Effect.provide(SyncerLayer));

			const startTime = Date.now();
			const result = yield* syncer.syncToFile.pipe(Effect.provide(SyncerLayer));
			const syncTime = Date.now() - startTime;

			/** Sync completed in ${syncTime}ms */

			expect(result.count).toBeGreaterThanOrEqual(10_000);
			expect(syncTime).toBeLessThan(60_000); // Should complete within 60 seconds
		}),
	);
});
