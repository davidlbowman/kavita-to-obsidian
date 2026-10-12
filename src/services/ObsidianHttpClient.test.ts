/**
 * Tests for the `requestUrl`-backed HttpClient.
 *
 * @module
 */
import { assert, beforeEach, describe, it } from "@effect/vitest";
import { Effect, Schema, Stream } from "effect";
import {
	HttpBody,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "effect/http";
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import { requestUrl } from "../__mocks__/obsidian.js";
import { ObsidianHttpClient, toRequestUrlParam } from "./ObsidianHttpClient.js";

const KAVITA = new URL("http://kavita.test/api/thing?apiKey=k&pluginName=p");

const respond = (
	status: number,
	body: string,
	headers: Record<string, string> = {},
): RequestUrlResponse => ({
	status,
	headers,
	arrayBuffer: new TextEncoder().encode(body).buffer,
	text: body,
	json: null,
});

const execute = (request: HttpClientRequest.HttpClientRequest) =>
	Effect.gen(function* () {
		const client = yield* HttpClient.HttpClient;
		return yield* client.execute(request);
	}).pipe(Effect.provide(ObsidianHttpClient));

const lastParam = (): RequestUrlParam => {
	const call = requestUrl.mock.lastCall;
	assert.isDefined(call);
	return call?.[0];
};

const withBody = (body: unknown, contentType?: string) =>
	toRequestUrlParam(
		HttpClientRequest.post(KAVITA).pipe(
			HttpClientRequest.setBody(HttpBody.raw(body, { contentType })),
		),
		KAVITA,
	);

describe("toRequestUrlParam", () => {
	it.effect("sends JSON bodies as strings with a content type", () =>
		Effect.gen(function* () {
			const request = HttpClientRequest.post(KAVITA).pipe(
				HttpClientRequest.setHeader("x-custom", "yes"),
				HttpClientRequest.setHeader("content-length", "99"),
				HttpClientRequest.bodyJsonUnsafe({ a: 1 }),
			);
			const param = yield* toRequestUrlParam(request, KAVITA);
			assert.strictEqual(param.url, KAVITA.href);
			assert.strictEqual(param.method, "POST");
			assert.strictEqual(param.body, '{"a":1}');
			assert.strictEqual(param.contentType, "application/json");
			assert.strictEqual(param.throw, false);
			assert.deepStrictEqual(param.headers, { "x-custom": "yes" });
		}),
	);

	it.effect("omits body and content type for empty bodies", () =>
		Effect.gen(function* () {
			const request = HttpClientRequest.get(KAVITA).pipe(
				HttpClientRequest.setHeader("content-type", "text/plain"),
			);
			const param = yield* toRequestUrlParam(request, KAVITA);
			assert.strictEqual(param.method, "GET");
			assert.isFalse("body" in param);
			assert.isFalse("contentType" in param);
			assert.deepStrictEqual(param.headers, {});
		}),
	);

	it.effect("passes raw string, Uint8Array, and ArrayBuffer bodies", () =>
		Effect.gen(function* () {
			const buffer = new TextEncoder().encode("abc").buffer;
			const text = yield* withBody("hello", "text/plain");
			assert.strictEqual(text.body, "hello");
			assert.strictEqual(text.contentType, "text/plain");
			const bytes = yield* withBody(new TextEncoder().encode("bytes"));
			assert.strictEqual(bytes.body, "bytes");
			const array = yield* withBody(buffer);
			assert.strictEqual(array.body, buffer);
		}),
	);

	it.effect("falls back to the content-type header for raw bodies", () =>
		Effect.gen(function* () {
			const param = yield* toRequestUrlParam(
				HttpClientRequest.post(KAVITA).pipe(
					HttpClientRequest.setBody(HttpBody.raw("a,b")),
					HttpClientRequest.setHeader("content-type", "text/csv"),
				),
				KAVITA,
			);
			assert.strictEqual(param.contentType, "text/csv");
			assert.deepStrictEqual(param.headers, {});
		}),
	);

	it.effect.each<{ readonly name: string; readonly body: HttpBody.HttpBody }>([
		{ name: "raw non-binary", body: HttpBody.raw(42) },
		{ name: "form data", body: HttpBody.formData(new FormData()) },
		{ name: "stream", body: HttpBody.stream(Stream.empty) },
	])("fails with a TransportError for $name bodies", ({ body }) =>
		Effect.gen(function* () {
			const request = HttpClientRequest.post(KAVITA).pipe(
				HttpClientRequest.setBody(body),
			);
			const error = yield* Effect.flip(toRequestUrlParam(request, KAVITA));
			assert.strictEqual(error.reason._tag, "TransportError");
		}),
	);
});

describe("ObsidianHttpClient", () => {
	beforeEach(() => {
		requestUrl.mockReset();
	});

	it.effect("sends the full URL including query params", () =>
		Effect.gen(function* () {
			requestUrl.mockResolvedValue(respond(200, "{}"));
			yield* execute(
				HttpClientRequest.post(
					"http://kavita.test/api/Plugin/authenticate",
				).pipe(
					HttpClientRequest.setUrlParams({ apiKey: "k", pluginName: "p" }),
				),
			);
			assert.strictEqual(
				lastParam().url,
				"http://kavita.test/api/Plugin/authenticate?apiKey=k&pluginName=p",
			);
		}),
	);

	it.effect("propagates status, headers, and JSON bodies", () =>
		Effect.gen(function* () {
			requestUrl.mockResolvedValue(
				respond(201, '{"token":"abc"}', {
					"content-type": "application/json",
					"x-trace": "t",
				}),
			);
			const response = yield* execute(HttpClientRequest.get(KAVITA));
			assert.strictEqual(response.status, 201);
			assert.strictEqual(response.headers["x-trace"], "t");
			const body = yield* HttpClientResponse.schemaBodyJson(
				Schema.Struct({ token: Schema.String }),
			)(response);
			assert.deepStrictEqual(body, { token: "abc" });
		}),
	);

	it.effect.each([204, 304])("accepts a %i response with no body", (status) =>
		Effect.gen(function* () {
			requestUrl.mockResolvedValue(respond(status, "ignored"));
			const response = yield* execute(HttpClientRequest.get(KAVITA));
			assert.strictEqual(response.status, status);
			assert.strictEqual(yield* response.text, "");
		}),
	);

	it.effect("maps a rejected requestUrl to a TransportError", () =>
		Effect.gen(function* () {
			requestUrl.mockRejectedValue(new Error("ECONNREFUSED"));
			const error = yield* Effect.flip(execute(HttpClientRequest.get(KAVITA)));
			assert.strictEqual(error._tag, "HttpClientError");
			assert.strictEqual(error.reason._tag, "TransportError");
		}),
	);

	it.effect("fails before calling requestUrl for unsupported bodies", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				execute(
					HttpClientRequest.post(KAVITA).pipe(
						HttpClientRequest.setBody(HttpBody.formData(new FormData())),
					),
				),
			);
			assert.strictEqual(error.reason._tag, "TransportError");
			assert.strictEqual(requestUrl.mock.calls.length, 0);
		}),
	);
});
