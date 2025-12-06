/**
 * Integration tests for Kavita API client.
 *
 * These tests run against a real Kavita instance.
 * Run `bun run integration:up && bun run integration:setup` first.
 *
 * @module
 */
import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { KavitaClient } from "../src/services/KavitaClient.js";
import { PluginConfig } from "../src/services/PluginConfig.js";

const KAVITA_URL = process.env.KAVITA_URL ?? "http://localhost:5000";
const KAVITA_API_KEY = process.env.KAVITA_API_KEY ?? "";

const TestConfigLayer = Layer.succeed(
	PluginConfig,
	new PluginConfig({
		kavitaUrl: new URL(KAVITA_URL),
		kavitaApiKey: Redacted.make(KAVITA_API_KEY),
		outputPath: "test-output.md",
		matchThreshold: 0.7,
		includeComments: true,
		includeSpoilers: false,
	}),
);

const KavitaClientLayer = KavitaClient.DefaultWithoutDependencies.pipe(
	Layer.provide(TestConfigLayer),
	Layer.provide(FetchHttpClient.layer),
);

describe("KavitaClient Integration", () => {
	it.effect.skip("fetches libraries from Kavita", () =>
		Effect.gen(function* () {
			const client = yield* KavitaClient;
			const libraries = yield* client.getLibraries;

			expect(libraries).toBeDefined();
			expect(Array.isArray(libraries)).toBe(true);
		}).pipe(Effect.provide(KavitaClientLayer)),
	);

	it.effect.skip("fetches series from Kavita", () =>
		Effect.gen(function* () {
			const client = yield* KavitaClient;
			const series = yield* client.getAllSeries;

			expect(series).toBeDefined();
			expect(Array.isArray(series)).toBe(true);
		}).pipe(Effect.provide(KavitaClientLayer)),
	);

	it.effect.skip("fetches annotations from Kavita", () =>
		Effect.gen(function* () {
			const client = yield* KavitaClient;
			const annotations = yield* client.fetchAllAnnotations;

			expect(annotations).toBeDefined();
			expect(Array.isArray(annotations)).toBe(true);
		}).pipe(Effect.provide(KavitaClientLayer)),
	);
});
