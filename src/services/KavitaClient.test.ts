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
	}),
);

const mockAuthResponse = { token: "mock-jwt-token" };

const createMockHttpClient = (responseBody: unknown, status = 200) =>
	Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request) => {
			// Return auth response for Plugin/authenticate endpoint
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
});
