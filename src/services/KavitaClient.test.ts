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
		seriesId: 100,
		content: "This is a highlight",
		comment: "My note",
		spoiler: false,
		highlightSlot: 1,
		page: 42,
	},
	{
		id: 2,
		chapterId: 10,
		seriesId: 100,
		content: "Another highlight",
		spoiler: true,
		highlightSlot: 2,
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

const createMockHttpClient = (responseBody: unknown, status = 200) =>
	Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request) =>
			Effect.succeed(
				HttpClientResponse.fromWeb(
					request,
					new Response(JSON.stringify(responseBody), {
						status,
						headers: { "Content-Type": "application/json" },
					}),
				),
			),
		),
	);

describe("KavitaClient", () => {
	describe("fetchAllAnnotations", () => {
		it.effect("fetches annotations successfully", () =>
			Effect.gen(function* () {
				const client = yield* KavitaClient;
				const annotations = yield* client.fetchAllAnnotations;

				expect(annotations).toHaveLength(2);
				expect(annotations[0]?.id).toBe(1);
				expect(annotations[0]?.content).toBe("This is a highlight");
				expect(annotations[1]?.id).toBe(2);
				expect(annotations[1]?.spoiler).toBe(true);
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
						HttpClient.make(() =>
							Effect.succeed(
								HttpClientResponse.fromWeb(
									{ url: "http://test" } as never,
									new Response("Unauthorized", { status: 401 }),
								),
							),
						),
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
