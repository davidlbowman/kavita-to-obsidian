/**
 * Tests for AnnotationSyncer service.
 *
 * @module
 */
import { describe, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { expect } from "vitest";
import type { AnnotationDto } from "../schemas.js";
import { AnnotationSyncer } from "./AnnotationSyncer.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianAdapter } from "./ObsidianAdapter.js";
import { PluginConfig } from "./PluginConfig.js";

const createAnnotation = (
	overrides: Partial<typeof AnnotationDto.Type> = {},
): typeof AnnotationDto.Type => ({
	id: 1,
	xPath: "/html/body/p[1]",
	endingXPath: null,
	selectedText: "Test highlight",
	comment: null,
	commentHtml: null,
	commentPlainText: null,
	chapterTitle: null,
	context: null,
	highlightCount: 14,
	containsSpoiler: false,
	pageNumber: 1,
	selectedSlotIndex: 0,
	likes: [],
	seriesName: null,
	libraryName: null,
	chapterId: 1,
	volumeId: 1,
	seriesId: 1,
	libraryId: 1,
	ownerUserId: 1,
	ownerUsername: null,
	ageRating: 0,
	createdUtc: "2025-01-01T00:00:00Z",
	lastModifiedUtc: "2025-01-01T00:00:00Z",
	...overrides,
});

const createMockKavitaClient = (
	annotations: Array<typeof AnnotationDto.Type>,
) =>
	Layer.succeed(KavitaClient, {
		fetchAllAnnotations: Effect.succeed(annotations),
		fetchAnnotationsFiltered: () => Effect.succeed(annotations),
	} as unknown as typeof KavitaClient.Service);

const createMockObsidianAdapter = () => {
	const files = new Map<string, string>();

	const adapter = {
		writeFile: (path: string, content: string) =>
			Effect.sync(() => {
				files.set(path, content);
			}),
		appendToFile: (path: string, content: string) =>
			Effect.sync(() => {
				const existing = files.get(path) ?? "";
				files.set(path, existing + content);
			}),
		readFile: (path: string) =>
			Effect.sync(() => {
				return files.get(path) ?? "";
			}),
		getFile: (_path: string) => Effect.succeed(Option.none()),
		listMarkdownFiles: Effect.succeed([]),
	};

	return {
		layer: Layer.succeed(
			ObsidianAdapter,
			adapter as unknown as typeof ObsidianAdapter.Service,
		),
		files,
	};
};

const createMockConfig = (
	overrides: Partial<typeof PluginConfig.Service> = {},
) =>
	Layer.succeed(PluginConfig, {
		kavitaUrl: new URL("http://localhost:5000"),
		kavitaApiKey: Redacted.make("test-api-key"),
		outputPath: "kavita-annotations.md",
		matchThreshold: 0.7,
		includeComments: true,
		includeSpoilers: false,
		...overrides,
	} as unknown as typeof PluginConfig.Service);

describe("AnnotationSyncer", () => {
	describe("syncToFile", () => {
		it.effect("syncs annotations to file", () => {
			const mockObsidian = createMockObsidianAdapter();

			return Effect.gen(function* () {
				const syncer = yield* AnnotationSyncer;
				const result = yield* syncer.syncToFile;

				expect(result.count).toBe(2);
				expect(result.outputPath).toBe("kavita-annotations.md");

				const fileContent = mockObsidian.files.get("kavita-annotations.md");
				expect(fileContent).toBeDefined();
				expect(fileContent).toContain("First highlight");
				expect(fileContent).toContain("Second highlight");
			}).pipe(
				Effect.provide(AnnotationSyncer.Default),
				Effect.provide(
					createMockKavitaClient([
						createAnnotation({
							id: 1,
							seriesId: 1,
							selectedText: "First highlight",
						}),
						createAnnotation({
							id: 2,
							seriesId: 1,
							selectedText: "Second highlight",
						}),
					]),
				),
				Effect.provide(mockObsidian.layer),
				Effect.provide(createMockConfig()),
			);
		});

		it.effect("returns zero count for empty annotations", () =>
			Effect.gen(function* () {
				const syncer = yield* AnnotationSyncer;
				const result = yield* syncer.syncToFile;

				expect(result.count).toBe(0);
			}).pipe(
				Effect.provide(AnnotationSyncer.Default),
				Effect.provide(createMockKavitaClient([])),
				Effect.provide(createMockObsidianAdapter().layer),
				Effect.provide(createMockConfig()),
			),
		);

		it.effect("uses custom output path from config", () =>
			Effect.gen(function* () {
				const syncer = yield* AnnotationSyncer;
				const result = yield* syncer.syncToFile;

				expect(result.outputPath).toBe("custom/path.md");
			}).pipe(
				Effect.provide(AnnotationSyncer.Default),
				Effect.provide(createMockKavitaClient([createAnnotation()])),
				Effect.provide(createMockObsidianAdapter().layer),
				Effect.provide(createMockConfig({ outputPath: "custom/path.md" })),
			),
		);

		it.effect("respects includeSpoilers option", () => {
			const mockObsidian = createMockObsidianAdapter();

			return Effect.gen(function* () {
				const syncer = yield* AnnotationSyncer;
				yield* syncer.syncToFile;

				const fileContent = mockObsidian.files.get("kavita-annotations.md");
				expect(fileContent).toContain("Normal");
				expect(fileContent).not.toContain("Spoiler");
			}).pipe(
				Effect.provide(AnnotationSyncer.Default),
				Effect.provide(
					createMockKavitaClient([
						createAnnotation({
							id: 1,
							selectedText: "Normal",
							containsSpoiler: false,
						}),
						createAnnotation({
							id: 2,
							selectedText: "Spoiler",
							containsSpoiler: true,
						}),
					]),
				),
				Effect.provide(mockObsidian.layer),
				Effect.provide(createMockConfig({ includeSpoilers: false })),
			);
		});
	});
});
