/**
 * Tests for KavitaClient service.
 *
 * @module
 */

import { HttpClient, HttpClientResponse } from "@effect/platform";
import { describe, it } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { expect } from "vitest";
import { KavitaNetworkError } from "../errors.js";
import { KavitaClient } from "./KavitaClient.js";
import { PluginConfig } from "./PluginConfig.js";

const mockAnnotations = [
	{
		id: 1,
		chapterId: 10,
		volumeId: 1,
		seriesId: 100,
		libraryId: 1,
		ownerUserId: 1,
		ownerUsername: null,
		xPath: "/html/body/p[1]",
		endingXPath: null,
		selectedText: "This is a highlight",
		comment: "My note",
		commentHtml: null,
		commentPlainText: null,
		chapterTitle: null,
		context: null,
		highlightCount: 19,
		containsSpoiler: false,
		pageNumber: 42,
		selectedSlotIndex: 1,
		likes: [],
		seriesName: null,
		libraryName: null,
		ageRating: 0,
		createdUtc: "2025-01-01T00:00:00Z",
		lastModifiedUtc: "2025-01-01T00:00:00Z",
	},
	{
		id: 2,
		chapterId: 10,
		volumeId: 1,
		seriesId: 100,
		libraryId: 1,
		ownerUserId: 1,
		ownerUsername: null,
		xPath: "/html/body/p[2]",
		endingXPath: null,
		selectedText: "Another highlight",
		comment: null,
		commentHtml: null,
		commentPlainText: null,
		chapterTitle: null,
		context: null,
		highlightCount: 17,
		containsSpoiler: true,
		pageNumber: 43,
		selectedSlotIndex: 2,
		likes: [],
		seriesName: null,
		libraryName: null,
		ageRating: 0,
		createdUtc: "2025-01-01T00:00:00Z",
		lastModifiedUtc: "2025-01-01T00:00:00Z",
	},
];

const MockPluginConfig = Layer.succeed(
	PluginConfig,
	new PluginConfig({
		kavitaUrl: new URL("http://test-kavita.local"),
		kavitaApiKey: Redacted.make("test-api-key"),
		outputPath: "test.md",
		matchThreshold: 0.7,
		includeComments: true,
		includeSpoilers: false,
		includeTags: true,
		tagPrefix: "kavita/",
		includeWikilinks: true,
	}),
);

const mockAuthResponse = { token: "mock-jwt-token" };

const createMockHttpClient = (responseBody: unknown, status = 200) =>
	Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request) => {
			const url = request.url;
			const body = url.includes("/api/Plugin/authenticate")
				? mockAuthResponse
				: responseBody;

			return Effect.succeed(
				HttpClientResponse.fromWeb(
					request,
					new Response(JSON.stringify(body), {
						status,
						headers: { "Content-Type": "application/json" },
					}),
				),
			);
		}),
	);

const createRoutedMockHttpClient = (
	routes: Record<string, { body: unknown; status?: number }>,
) =>
	Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request) => {
			const url = request.url;

			if (url.includes("/api/Plugin/authenticate")) {
				return Effect.succeed(
					HttpClientResponse.fromWeb(
						request,
						new Response(JSON.stringify(mockAuthResponse), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						}),
					),
				);
			}

			for (const [pattern, response] of Object.entries(routes)) {
				if (url.includes(pattern)) {
					return Effect.succeed(
						HttpClientResponse.fromWeb(
							request,
							new Response(JSON.stringify(response.body), {
								status: response.status ?? 200,
								headers: { "Content-Type": "application/json" },
							}),
						),
					);
				}
			}

			return Effect.succeed(
				HttpClientResponse.fromWeb(
					request,
					new Response("Not Found", { status: 404 }),
				),
			);
		}),
	);

const mockLibraries = [
	{
		id: 1,
		name: "Comics",
		type: 0,
		folders: ["/books/comics"],
	},
	{
		id: 2,
		name: "Manga",
		type: 2,
		folders: ["/books/manga"],
	},
];

const mockSeries = [
	{
		id: 1,
		name: "Test Series",
		libraryId: 1,
		pages: 100,
	},
];

const mockSeriesPaged = {
	result: mockSeries,
	pagination: { currentPage: 1, totalPages: 1, totalItems: 1 },
};

const mockVolumes = [
	{
		id: 1,
		number: 1,
		name: "Volume 1",
		chapters: [
			{
				id: 10,
				number: "1",
				title: "Chapter 1",
				pages: 20,
				volumeId: 1,
				sortOrder: 1,
				titleName: "The Beginning",
				writers: [{ id: 1, name: "Author Name", description: null }],
				genres: [{ id: 1, title: "Fantasy" }],
			},
		],
	},
];

const mockSeriesMetadata = {
	id: 1,
	seriesId: 1,
	summary: "A test series",
	releaseYear: 2024,
	language: "en",
	genres: [{ id: 1, title: "Fantasy" }],
	writers: [{ id: 1, name: "Author Name", description: null }],
};

describe("KavitaClient", () => {
	describe("fetchAllAnnotations", () => {
		it.effect("fetches annotations successfully", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const annotations = yield* client.fetchAllAnnotations;

				expect(annotations).toHaveLength(2);
				expect(annotations[0]?.id).toBe(1);
				expect(annotations[0]?.selectedText).toBe("This is a highlight");
				expect(annotations[1]?.id).toBe(2);
				expect(annotations[1]?.containsSpoiler).toBe(true);
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(createMockHttpClient(mockAnnotations)),
			),
		);

		it.effect("returns empty array when no annotations", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const annotations = yield* client.fetchAllAnnotations;

				expect(annotations).toHaveLength(0);
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(createMockHttpClient([])),
			),
		);

		it.effect("maps HTTP errors to KavitaNetworkError", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const result = yield* client.fetchAllAnnotations.pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(KavitaNetworkError);
					expect(result.left.url).toBe("/api/Annotation/all-filtered");
				}
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					Layer.succeed(
						HttpClient.HttpClient,
						HttpClient.make((request) => {
							// Auth endpoint succeeds, annotation endpoint fails
							const url = request.url;
							if (url.includes("/api/Plugin/authenticate")) {
								return Effect.succeed(
									HttpClientResponse.fromWeb(
										request,
										new Response(JSON.stringify(mockAuthResponse), {
											status: 200,
											headers: { "Content-Type": "application/json" },
										}),
									),
								);
							}
							return Effect.succeed(
								HttpClientResponse.fromWeb(
									request,
									new Response("Unauthorized", { status: 401 }),
								),
							);
						}),
					),
				),
			),
		);
	});

	describe("fetchAnnotationsFiltered", () => {
		it.effect("fetches annotations with filter", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const annotations = yield* client.fetchAnnotationsFiltered({
					seriesIds: [100],
					includeSpoilers: true,
				});

				expect(annotations).toHaveLength(2);
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(createMockHttpClient(mockAnnotations)),
			),
		);
	});

	describe("getLibraries", () => {
		it.effect("fetches libraries successfully", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const libraries = yield* client.getLibraries;

				expect(libraries).toHaveLength(2);
				expect(libraries[0]?.name).toBe("Comics");
				expect(libraries[1]?.name).toBe("Manga");
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Library/libraries": { body: mockLibraries },
					}),
				),
			),
		);
	});

	describe("createLibrary", () => {
		it.effect("creates a library successfully", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				yield* client.createLibrary({
					name: "New Library",
					type: 0,
					folders: ["/books/new"],
					fileGroupTypes: [],
					excludePatterns: [],
					enableMetadata: true,
				});
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Library/create": { body: {} },
					}),
				),
			),
		);
	});

	describe("scanAllLibraries", () => {
		it.effect("triggers scan of all libraries", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				yield* client.scanAllLibraries;
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Library/scan-all": { body: {} },
					}),
				),
			),
		);
	});

	describe("scanLibrary", () => {
		it.effect("triggers scan of a specific library", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				yield* client.scanLibrary(1);
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Library/scan": { body: {} },
					}),
				),
			),
		);

		it.effect("supports force parameter", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				yield* client.scanLibrary(1, false);
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Library/scan": { body: {} },
					}),
				),
			),
		);
	});

	describe("getAllSeries", () => {
		it.effect("fetches series from array response", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const series = yield* client.getAllSeries;

				expect(series).toHaveLength(1);
				expect(series[0]?.name).toBe("Test Series");
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Series/all-v2": { body: mockSeries },
					}),
				),
			),
		);

		it.effect("fetches series from paged response", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const series = yield* client.getAllSeries;

				expect(series).toHaveLength(1);
				expect(series[0]?.name).toBe("Test Series");
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Series/all-v2": { body: mockSeriesPaged },
					}),
				),
			),
		);
	});

	describe("getVolumes", () => {
		it.effect("fetches volumes for a series", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const volumes = yield* client.getVolumes(1);

				expect(volumes).toHaveLength(1);
				expect(volumes[0]?.name).toBe("Volume 1");
				expect(volumes[0]?.chapters).toHaveLength(1);
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Series/volumes": { body: mockVolumes },
					}),
				),
			),
		);
	});

	describe("createAnnotation", () => {
		it.effect("creates an annotation successfully", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const annotation = yield* client.createAnnotation({
					chapterId: 10,
					volumeId: 1,
					seriesId: 1,
					libraryId: 1,
					ownerUserId: 1,
					selectedText: "Test highlight",
					xPath: "/html/body/p[1]",
					pageNumber: 1,
					highlightCount: 14,
					selectedSlotIndex: 0,
					containsSpoiler: false,
				});

				expect(annotation.id).toBe(1);
				expect(annotation.selectedText).toBe("This is a highlight");
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Annotation/create": { body: mockAnnotations[0] },
					}),
				),
			),
		);
	});

	describe("getSeriesMetadata", () => {
		it.effect("fetches series metadata", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const metadata = yield* client.getSeriesMetadata(1);

				expect(metadata.seriesId).toBe(1);
				expect(metadata.summary).toBe("A test series");
				expect(metadata.genres).toHaveLength(1);
				expect(metadata.writers).toHaveLength(1);
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Series/metadata": { body: mockSeriesMetadata },
					}),
				),
			),
		);

		it.effect("maps HTTP errors to KavitaNetworkError", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const result = yield* client.getSeriesMetadata(999).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(KavitaNetworkError);
					expect(result.left.url).toContain("/api/Series/metadata");
				}
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Series/metadata": { body: "Server Error", status: 500 },
					}),
				),
			),
		);
	});

	describe("getVolumes error handling", () => {
		it.effect("maps HTTP errors to KavitaNetworkError", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const result = yield* client.getVolumes(999).pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(KavitaNetworkError);
					expect(result.left.url).toBe("/api/Series/volumes");
				}
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Series/volumes": { body: "Not Found", status: 404 },
					}),
				),
			),
		);
	});

	describe("createAnnotation error handling", () => {
		it.effect("maps HTTP errors to KavitaNetworkError", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const result = yield* client
					.createAnnotation({
						chapterId: 10,
						volumeId: 1,
						seriesId: 1,
						libraryId: 1,
						ownerUserId: 1,
						selectedText: "Test",
						xPath: "/html/body/p[1]",
						pageNumber: 1,
						highlightCount: 4,
						selectedSlotIndex: 0,
						containsSpoiler: false,
					})
					.pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(KavitaNetworkError);
					expect(result.left.url).toBe("/api/Annotation/create");
				}
			}).pipe(
				Effect.provide(KavitaClient.Default),
				Effect.provide(MockPluginConfig),
				Effect.provide(
					createRoutedMockHttpClient({
						"/api/Annotation/create": { body: "Forbidden", status: 403 },
					}),
				),
			),
		);
	});
});
