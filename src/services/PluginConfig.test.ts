/**
 * Tests for PluginConfig service layers.
 *
 * @module
 */
import { describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Redacted } from "effect";
import { expect } from "vitest";
import { PluginConfig } from "./PluginConfig.js";

describe("PluginConfig", () => {
	describe("Default", () => {
		it.effect("provides default configuration values", () =>
			Effect.gen(function* () {
				const config = yield* PluginConfig;

				expect(config.kavitaUrl.href).toBe("http://localhost:5000/");
				expect(Redacted.value(config.kavitaApiKey)).toBe("");
				expect(config.outputPath).toBe("kavita-annotations.md");
				expect(config.matchThreshold).toBe(0.7);
				expect(config.includeComments).toBe(true);
				expect(config.includeSpoilers).toBe(false);
			}).pipe(Effect.provide(PluginConfig.Default)),
		);
	});

	describe("fromSettings", () => {
		it.effect("creates config from plugin settings", () =>
			Effect.gen(function* () {
				const config = yield* PluginConfig;

				expect(config.kavitaUrl.href).toBe("https://my-kavita.example.com/");
				expect(Redacted.value(config.kavitaApiKey)).toBe("test-api-key");
				expect(config.outputPath).toBe("notes/kavita.md");
				expect(config.matchThreshold).toBe(0.8);
				expect(config.includeComments).toBe(false);
				expect(config.includeSpoilers).toBe(true);
			}).pipe(
				Effect.provide(
					PluginConfig.fromSettings({
						kavitaUrl: "https://my-kavita.example.com",
						kavitaApiKey: "test-api-key",
						outputPath: "notes/kavita.md",
						matchThreshold: 0.8,
						includeComments: false,
						includeSpoilers: true,
					}),
				),
			),
		);
	});

	describe("fromEnv", () => {
		it.effect("creates config from environment variables", () =>
			Effect.gen(function* () {
				const config = yield* PluginConfig;

				expect(config.kavitaUrl.href).toBe("https://env-kavita.example.com/");
				expect(Redacted.value(config.kavitaApiKey)).toBe("env-api-key");
				expect(config.outputPath).toBe("env/output.md");
				expect(config.matchThreshold).toBe(0.9);
				expect(config.includeComments).toBe(false);
				expect(config.includeSpoilers).toBe(true);
			}).pipe(
				Effect.provide(PluginConfig.fromEnv),
				Effect.withConfigProvider(
					ConfigProvider.fromMap(
						new Map([
							["KAVITA_URL", "https://env-kavita.example.com"],
							["KAVITA_API_KEY", "env-api-key"],
							["OUTPUT_PATH", "env/output.md"],
							["MATCH_THRESHOLD", "0.9"],
							["INCLUDE_COMMENTS", "false"],
							["INCLUDE_SPOILERS", "true"],
						]),
					),
				),
			),
		);

		it.effect("uses defaults when env vars are missing", () =>
			Effect.gen(function* () {
				const config = yield* PluginConfig;

				expect(config.kavitaUrl.href).toBe("http://localhost:5000/");
				expect(Redacted.value(config.kavitaApiKey)).toBe("");
				expect(config.outputPath).toBe("kavita-annotations.md");
				expect(config.matchThreshold).toBe(0.7);
				expect(config.includeComments).toBe(true);
				expect(config.includeSpoilers).toBe(false);
			}).pipe(
				Effect.provide(PluginConfig.fromEnv),
				Effect.withConfigProvider(ConfigProvider.fromMap(new Map())),
			),
		);
	});
});
