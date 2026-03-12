/**
 * Tests for PluginConfig service layers.
 *
 * @module
 */
import { describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { expect } from "vitest";
import { DEFAULT_ANNOTATION_TEMPLATE } from "../schemas.js";
import { PluginConfig } from "./PluginConfig.js";

describe("PluginConfig", () => {
	describe("Default values via fromEnv", () => {
		it.effect("provides default configuration values", () =>
			Effect.gen(function* () {
				const config = yield* PluginConfig;

				expect(config.kavitaUrl.href).toBe("http://localhost:5000/");
				expect(Redacted.value(config.kavitaApiKey)).toBe("");
				expect(config.outputPath).toBe("kavita-annotations.md");
				expect(config.matchThreshold).toBe(0.7);
				expect(config.includeComments).toBe(true);
				expect(config.includeSpoilers).toBe(false);
				expect(config.includeTags).toBe(true);
				expect(config.tagPrefix).toBe("");
				expect(config.includeWikilinks).toBe(true);
				expect(config.exportMode).toBe("hierarchical");
				expect(config.annotationTemplate).toBe(DEFAULT_ANNOTATION_TEMPLATE);
			}).pipe(
				Effect.provide(PluginConfig.fromEnv),
				Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
			),
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
				expect(config.includeTags).toBe(false);
				expect(config.tagPrefix).toBe("book/");
				expect(config.includeWikilinks).toBe(false);
				expect(config.annotationTemplate).toBe("custom template");
			}).pipe(
				Effect.provide(
					PluginConfig.fromSettings({
						kavitaUrl: "https://my-kavita.example.com",
						kavitaApiKey: "test-api-key",
						outputPath: "notes/kavita.md",
						matchThreshold: 0.8,
						includeComments: false,
						includeSpoilers: true,
						includeTags: false,
						tagPrefix: "book/",
						includeWikilinks: false,
						exportMode: "single-file",
						rootFolderName: "Kavita Annotations",
						deleteOrphanedFiles: true,
						annotationTemplate: "custom template",
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
				expect(config.includeTags).toBe(false);
				expect(config.tagPrefix).toBe("book/");
				expect(config.includeWikilinks).toBe(false);
				expect(config.annotationTemplate).toBe("env custom template");
			}).pipe(
				Effect.provide(PluginConfig.fromEnv),
				Effect.provide(
					ConfigProvider.layer(
						ConfigProvider.fromUnknown({
							KAVITA_URL: "https://env-kavita.example.com",
							KAVITA_API_KEY: "env-api-key",
							OUTPUT_PATH: "env/output.md",
							MATCH_THRESHOLD: "0.9",
							INCLUDE_COMMENTS: "false",
							INCLUDE_SPOILERS: "true",
							INCLUDE_TAGS: "false",
							TAG_PREFIX: "book/",
							INCLUDE_WIKILINKS: "false",
							ANNOTATION_TEMPLATE: "env custom template",
						}),
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
				expect(config.includeTags).toBe(true);
				expect(config.tagPrefix).toBe("");
				expect(config.includeWikilinks).toBe(true);
				expect(config.exportMode).toBe("hierarchical");
				expect(config.annotationTemplate).toBe(DEFAULT_ANNOTATION_TEMPLATE);
			}).pipe(
				Effect.provide(PluginConfig.fromEnv),
				Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
			),
		);
	});
});
