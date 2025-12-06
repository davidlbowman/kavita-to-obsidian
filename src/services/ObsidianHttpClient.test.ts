/**
 * Tests for ObsidianHttpClient layer.
 *
 * This module tests the ObsidianHttpClient layer which adapts Obsidian's
 * requestUrl to the Effect HttpClient interface.
 *
 * @module
 */

import { HttpBody, HttpClient, HttpClientRequest } from "@effect/platform";
import { describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { requestUrl } from "obsidian";
import { beforeEach, expect, vi } from "vitest";
import { ObsidianHttpClient } from "./ObsidianHttpClient.js";

const mockRequestUrl = vi.mocked(requestUrl);

describe("ObsidianHttpClient", () => {
	beforeEach(() => {
		mockRequestUrl.mockReset();
	});

	it("exports a Layer", () => {
		expect(ObsidianHttpClient).toBeDefined();
	});

	it.effect("makes GET request via requestUrl", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				headers: { "content-type": "application/json" },
				text: '{"message": "success"}',
				arrayBuffer: new ArrayBuffer(0),
				json: { message: "success" },
			});

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.get("http://test.local/api/test");
			const response = yield* client.execute(request).pipe(Effect.scoped);

			expect(response.status).toBe(200);
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "http://test.local/api/test",
					method: "GET",
					throw: false,
				}),
			);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("makes POST request with JSON body", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 201,
				headers: { "content-type": "application/json" },
				text: '{"id": 1}',
				arrayBuffer: new ArrayBuffer(0),
				json: { id: 1 },
			});

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.post(
				"http://test.local/api/create",
			).pipe(HttpClientRequest.bodyUnsafeJson({ name: "test" }));
			const response = yield* client.execute(request).pipe(Effect.scoped);

			expect(response.status).toBe(201);
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: "http://test.local/api/create",
					method: "POST",
				}),
			);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("includes custom headers (lowercase normalized)", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				headers: {},
				text: "OK",
				arrayBuffer: new ArrayBuffer(0),
				json: null,
			});

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.get("http://test.local/api/auth").pipe(
				HttpClientRequest.setHeader("Authorization", "Bearer token123"),
				HttpClientRequest.setHeader("x-api-key", "api-key-456"),
			);
			yield* client.execute(request).pipe(Effect.scoped);

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						"x-api-key": "api-key-456",
					}),
				}),
			);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("handles network errors", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockRejectedValueOnce(new Error("Network error"));

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.get("http://test.local/api/fail");
			const result = yield* client
				.execute(request)
				.pipe(Effect.scoped, Effect.either);

			expect(result._tag).toBe("Left");
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("handles non-200 status codes", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 404,
				headers: {},
				text: "Not Found",
				arrayBuffer: new ArrayBuffer(0),
				json: null,
			});

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.get("http://test.local/api/missing");
			const response = yield* client.execute(request).pipe(Effect.scoped);

			expect(response.status).toBe(404);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("handles empty response body", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				headers: {},
				text: "",
				arrayBuffer: new ArrayBuffer(0),
				json: null,
			});

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.del("http://test.local/api/resource/1");
			const response = yield* client.execute(request).pipe(Effect.scoped);

			expect(response.status).toBe(200);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("handles Raw body with string", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				headers: {},
				text: "OK",
				arrayBuffer: new ArrayBuffer(0),
				json: null,
			});

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.post("http://test.local/api/raw").pipe(
				HttpClientRequest.setBody(HttpBody.raw("raw string body")),
			);
			yield* client.execute(request).pipe(Effect.scoped);

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: "raw string body",
				}),
			);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("handles Raw body with Uint8Array", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				headers: {},
				text: "OK",
				arrayBuffer: new ArrayBuffer(0),
				json: null,
			});

			const client = yield* HttpClient.HttpClient;
			const uint8Body = new TextEncoder().encode("uint8 body");
			const request = HttpClientRequest.post("http://test.local/api/raw").pipe(
				HttpClientRequest.setBody(HttpBody.raw(uint8Body)),
			);
			yield* client.execute(request).pipe(Effect.scoped);

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: "uint8 body",
				}),
			);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("handles Raw body with ArrayBuffer", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				headers: {},
				text: "OK",
				arrayBuffer: new ArrayBuffer(0),
				json: null,
			});

			const client = yield* HttpClient.HttpClient;
			const arrayBuffer = new TextEncoder().encode("arraybuffer body").buffer;
			const request = HttpClientRequest.post("http://test.local/api/raw").pipe(
				HttpClientRequest.setBody(HttpBody.raw(arrayBuffer)),
			);
			yield* client.execute(request).pipe(Effect.scoped);

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: arrayBuffer,
				}),
			);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("handles Uint8Array body type", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				headers: {},
				text: "OK",
				arrayBuffer: new ArrayBuffer(0),
				json: null,
			});

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.post("http://test.local/api/raw").pipe(
				HttpClientRequest.setBody(
					HttpBody.uint8Array(new TextEncoder().encode("uint8 typed body")),
				),
			);
			yield* client.execute(request).pipe(Effect.scoped);

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: "uint8 typed body",
				}),
			);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);

	it.effect("handles response.text throwing", () =>
		Effect.gen(function* () {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				headers: {},
				get text() {
					throw new Error("Cannot get text");
				},
				arrayBuffer: new ArrayBuffer(0),
				json: null,
			});

			const client = yield* HttpClient.HttpClient;
			const request = HttpClientRequest.get("http://test.local/api/broken");
			const response = yield* client.execute(request).pipe(Effect.scoped);

			expect(response.status).toBe(200);
		}).pipe(Effect.provide(ObsidianHttpClient)),
	);
});
