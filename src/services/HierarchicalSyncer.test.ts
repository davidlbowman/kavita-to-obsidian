/**
 * Tests for HierarchicalSyncer service.
 *
 * @module
 */
import { describe, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { expect } from "vitest";
import type { AnnotationDto, VolumeDto } from "../schemas.js";
import { HierarchicalSyncer } from "./HierarchicalSyncer.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianAdapter } from "./ObsidianAdapter.js";
import { PluginConfig } from "./PluginConfig.js";

const createAnnotation = (
	overrides: Partial<typeof AnnotationDto.Type> = {},
): typeof AnnotationDto.Type =>
	({
		id: 1,
		xPath: "/html/body/p[1]",
		endingXPath: null,
		selectedText: "Highlighted text",
		comment: "My note",
		commentHtml: null,
		commentPlainText: null,
		chapterTitle: "Chapter 1",
		context: null,
		highlightCount: 16,
		containsSpoiler: false,
		pageNumber: 42,
		selectedSlotIndex: 0,
		likes: [],
		seriesName: "Test Series",
		libraryName: "Books",
		chapterId: 10,
		volumeId: 1,
		seriesId: 100,
		libraryId: 1,
		ownerUserId: 1,
		ownerUsername: "user",
		ageRating: 0,
		createdUtc: "2024-01-01T00:00:00Z",
		lastModifiedUtc: "2024-01-01T00:00:00Z",
		...overrides,
	}) as typeof AnnotationDto.Type;

const mockVolumes: (typeof VolumeDto.Type)[] = [
	{
		id: 1,
		number: 1,
		name: "Volume 1",
		chapters: [
			{
				id: 10,
				number: "1",
				title: "Chapter 1",
				titleName: "The Beginning",
				sortOrder: 1,
				writers: [{ id: 1, name: "Test Author", description: null }],
				genres: [{ id: 1, title: "Fantasy" }],
			},
		],
	},
];

const createMockConfig = () =>
	Layer.succeed(
		PluginConfig,
		PluginConfig.of({
			kavitaUrl: new URL("http://test.local"),
			kavitaApiKey: Redacted.make("test-key"),
			outputPath: "test.md",
			matchThreshold: 0.7,
			includeComments: true,
			includeSpoilers: false,
			includeTags: true,
			tagPrefix: "",
			includeWikilinks: true,
			exportMode: "hierarchical",
			rootFolderName: "Kavita Annotations",
			deleteOrphanedFiles: true,
			annotationTemplate: "",
		}),
	);

const createMockKavitaClient = (
	annotations: (typeof AnnotationDto.Type)[],
	volumes: (typeof VolumeDto.Type)[] = mockVolumes,
) =>
	Layer.succeed(KavitaClient, {
		fetchAllAnnotations: Effect.succeed(annotations),
		fetchAnnotationsFiltered: () => Effect.succeed(annotations),
		getLibraries: Effect.succeed([]),
		createLibrary: () => Effect.void,
		scanAllLibraries: Effect.void,
		scanLibrary: () => Effect.void,
		getAllSeries: Effect.succeed([]),
		getVolumes: () => Effect.succeed(volumes),
		createAnnotation: () =>
			Effect.succeed(annotations[0] ?? createAnnotation()),
		getSeriesMetadata: () =>
			Effect.succeed({
				id: 1,
				seriesId: 100,
				summary: null,
				releaseYear: 2024,
				language: null,
				genres: [],
				tags: [],
				writers: [],
				coverArtists: [],
				publishers: [],
				characters: [],
				pencillers: [],
				inkers: [],
				colorists: [],
				letterers: [],
				editors: [],
				translators: [],
			}),
	} as typeof KavitaClient.Service);

/**
 * Creates a mock ObsidianAdapter that tracks writes and folders.
 * Returns both the layer and accessor functions.
 */
const createMockObsidianAdapter = () => {
	const writes: Array<{ path: string; content: string }> = [];
	const folders: Set<string> = new Set();

	const adapter = {
		writeFile: (path: string, content: string) =>
			Effect.sync(() => {
				writes.push({ path, content });
			}),
		appendToFile: () => Effect.void,
		readFile: () => Effect.succeed(""),
		getFile: (path: string) =>
			Effect.succeed(
				writes.some((w) => w.path === path)
					? Option.some({ path })
					: Option.none(),
			),
		listMarkdownFiles: Effect.succeed([]),
		ensureFolderExists: (path: string) =>
			Effect.sync(() => {
				folders.add(path);
			}),
		deleteFile: () => Effect.void,
		listFilesInFolder: () => Effect.succeed([]),
		listFoldersInFolder: () => Effect.succeed([]),
		folderExists: () => Effect.succeed(false),
		deleteFolder: () => Effect.void,
	};

	return {
		layer: Layer.succeed(
			ObsidianAdapter,
			adapter as unknown as typeof ObsidianAdapter.Service,
		),
		getWrites: () => writes,
		getFolders: () => folders,
	};
};

describe("HierarchicalSyncer", () => {
	describe("syncAll", () => {
		it.effect("returns empty result when no annotations", () =>
			Effect.gen(function* () {
				const syncer = yield* HierarchicalSyncer;
				const result = yield* syncer.syncAll;

				expect(result.totalAnnotations).toBe(0);
				expect(result.seriesCount).toBe(0);
				expect(result.bookCount).toBe(0);
				expect(result.filesCreated).toBe(0);
			}).pipe(
				Effect.provide(HierarchicalSyncer.layerNoDeps),
				Effect.provide(createMockKavitaClient([])),
				Effect.provide(createMockObsidianAdapter().layer),
				Effect.provide(createMockConfig()),
			),
		);

		it.effect("creates folders and files for annotations", () => {
			const mockAdapter = createMockObsidianAdapter();

			return Effect.gen(function* () {
				const syncer = yield* HierarchicalSyncer;
				const result = yield* syncer.syncAll;

				expect(result.totalAnnotations).toBe(1);
				expect(result.seriesCount).toBe(1);
				expect(result.bookCount).toBe(1);
				expect(result.filesCreated).toBe(1);

				const writes = mockAdapter.getWrites();
				expect(writes.length).toBe(1);
				expect(writes[0]?.path).toContain("Test Series");
				expect(writes[0]?.path).toContain(".md");
			}).pipe(
				Effect.provide(HierarchicalSyncer.layerNoDeps),
				Effect.provide(
					createMockKavitaClient([
						createAnnotation({
							id: 1,
							seriesName: "Test Series",
							chapterId: 10,
						}),
					]),
				),
				Effect.provide(mockAdapter.layer),
				Effect.provide(createMockConfig()),
			);
		});

		it.effect("groups annotations by series and chapter", () => {
			const mockAdapter = createMockObsidianAdapter();

			return Effect.gen(function* () {
				const syncer = yield* HierarchicalSyncer;
				const result = yield* syncer.syncAll;

				expect(result.totalAnnotations).toBe(4);
				expect(result.seriesCount).toBe(2);
				expect(result.bookCount).toBe(3);
				expect(result.filesCreated).toBe(3);

				const writes = mockAdapter.getWrites();
				expect(writes.length).toBe(3);
			}).pipe(
				Effect.provide(HierarchicalSyncer.layerNoDeps),
				Effect.provide(
					createMockKavitaClient([
						createAnnotation({
							id: 1,
							seriesId: 100,
							seriesName: "Series A",
							chapterId: 10,
						}),
						createAnnotation({
							id: 2,
							seriesId: 100,
							seriesName: "Series A",
							chapterId: 10,
						}),
						createAnnotation({
							id: 3,
							seriesId: 100,
							seriesName: "Series A",
							chapterId: 20,
						}),
						createAnnotation({
							id: 4,
							seriesId: 200,
							seriesName: "Series B",
							chapterId: 30,
						}),
					]),
				),
				Effect.provide(mockAdapter.layer),
				Effect.provide(createMockConfig()),
			);
		});

		it.effect("uses book title from volume metadata", () => {
			const mockAdapter = createMockObsidianAdapter();

			return Effect.gen(function* () {
				const syncer = yield* HierarchicalSyncer;
				yield* syncer.syncAll;

				const writes = mockAdapter.getWrites();
				expect(writes[0]?.path).toContain("The Beginning");
			}).pipe(
				Effect.provide(HierarchicalSyncer.layerNoDeps),
				Effect.provide(
					createMockKavitaClient([createAnnotation({ chapterId: 10 })]),
				),
				Effect.provide(mockAdapter.layer),
				Effect.provide(createMockConfig()),
			);
		});

		it.effect("includes frontmatter and wikilinks in generated files", () => {
			const mockAdapter = createMockObsidianAdapter();

			return Effect.gen(function* () {
				const syncer = yield* HierarchicalSyncer;
				yield* syncer.syncAll;

				const writes = mockAdapter.getWrites();
				const content = writes[0]?.content ?? "";

				expect(content).toContain("---");
				expect(content).toContain("tags:");
				expect(content).toContain("kavita");
				expect(content).toContain("[[My Series]]");
				expect(content).toContain("## Annotations");
				expect(content).toContain("> Important quote");
			}).pipe(
				Effect.provide(HierarchicalSyncer.layerNoDeps),
				Effect.provide(
					createMockKavitaClient([
						createAnnotation({
							seriesName: "My Series",
							selectedText: "Important quote",
						}),
					]),
				),
				Effect.provide(mockAdapter.layer),
				Effect.provide(createMockConfig()),
			);
		});
	});
});
