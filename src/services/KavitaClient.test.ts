/**
 * Tests for the Kavita API client against a routed fake HTTP server.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Layer, Schema } from "effect";
import {
	HttpClient,
	HttpClientError,
	type HttpClientRequest,
	HttpClientResponse,
} from "effect/http";
import {
	Annotation,
	Annotations,
	CurrentUser,
	DEFAULT_SETTINGS,
	PluginSession,
	Volumes,
} from "../schemas.js";
import { KavitaClient, PLUGIN_NAME, toKavitaError } from "./KavitaClient.js";
import { PluginConfig } from "./PluginConfig.js";

/**
 * The Kavita user object, as both `/api/Plugin/authenticate` and
 * `/api/Account` return it.
 */
const KavitaUser = Schema.Struct({
	...PluginSession.fields,
	...CurrentUser.fields,
});

/**
 * A request the fake server received.
 */
interface Received {
	readonly url: URL;
	readonly request: HttpClientRequest.HttpClientRequest;
	readonly body: unknown;
}

const json = (value: unknown, status = 200): Response =>
	new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});

const decodeBody = (request: HttpClientRequest.HttpClientRequest): unknown =>
	request.body._tag === "Uint8Array"
		? JSON.parse(new TextDecoder().decode(request.body.body))
		: undefined;

/**
 * Fake Kavita server; `route` returns `undefined` to simulate a transport failure.
 */
const fakeServer = (route: (url: URL) => Response | undefined) => {
	const received: Array<Received> = [];
	const layer = Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request, url) =>
			Effect.suspend(() => {
				received.push({ url, request, body: decodeBody(request) });
				const response = route(url);
				return response === undefined
					? Effect.fail(
							new HttpClientError.HttpClientError({
								reason: new HttpClientError.TransportError({ request }),
							}),
						)
					: Effect.succeed(HttpClientResponse.fromWeb(request, response));
			}),
		),
	);
	return { layer, received };
};

const API_KEY = "test-auth-key";

const clientLayer = (http: Layer.Layer<HttpClient.HttpClient>) =>
	KavitaClient.layerNoDeps.pipe(
		Layer.provide(
			PluginConfig.fromSettings({
				...DEFAULT_SETTINGS,
				kavitaUrl: "http://kavita.test",
				kavitaApiKey: API_KEY,
			}),
		),
		Layer.provide(http),
	);

const sampleOne = <S extends Schema.Top>(schema: S) =>
	Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 1 }).pipe(
		Effect.flatMap((values) =>
			values[0] === undefined
				? Effect.die("empty sample")
				: Effect.succeed(values[0]),
		),
	);

/**
 * Round-trip values through JSON the way the wire does, so expectations
 * match what the client decodes (e.g. `-0` becomes `0`).
 */
const wire = <S extends Schema.Codec<unknown, unknown>>(
	schema: S,
	value: S["Type"],
) => {
	const encoded = JSON.stringify(Schema.encodeUnknownSync(schema)(value));
	return {
		body: JSON.parse(encoded),
		decoded: Schema.decodeUnknownSync(schema)(JSON.parse(encoded)),
	};
};

const annotationsOf = Effect.gen(function* () {
	return yield* (yield* KavitaClient).annotations;
});

describe("KavitaClient", () => {
	it.effect(
		"exchanges the auth key, then fetches only the user's annotations",
		() =>
			Effect.gen(function* () {
				const user = yield* sampleOne(KavitaUser);
				const sampled = yield* Arbitrary.sampleEffect(
					Arbitrary.schema(Annotation),
					{ count: 8 },
				);
				const mixed = sampled.map((a, i) => ({
					...a,
					ownerUserId: i % 2 === 0 ? user.id : user.id + 1,
				}));
				const annotations = wire(Annotations, mixed);
				const server = fakeServer((url) => {
					switch (url.pathname) {
						case "/api/Plugin/authenticate":
						case "/api/Account":
							return json(Schema.encodeSync(KavitaUser)(user));
						case "/api/Annotation/all-filtered":
							return json(annotations.body);
						default:
							return json({}, 404);
					}
				});

				const result = yield* annotationsOf.pipe(
					Effect.provide(clientLayer(server.layer)),
				);

				assert.deepStrictEqual(
					result,
					annotations.decoded.filter((a) => a.ownerUserId === user.id),
				);
				const [auth, account, fetch] = server.received;
				assert.strictEqual(auth?.request.method, "POST");
				assert.strictEqual(auth?.url.pathname, "/api/Plugin/authenticate");
				assert.strictEqual(auth?.url.searchParams.get("apiKey"), API_KEY);
				assert.strictEqual(
					auth?.url.searchParams.get("pluginName"),
					PLUGIN_NAME,
				);
				assert.isUndefined(auth?.request.headers.authorization);
				assert.strictEqual(account?.request.method, "GET");
				assert.strictEqual(account?.url.pathname, "/api/Account");
				assert.strictEqual(
					account?.request.headers.authorization,
					`Bearer ${user.token}`,
				);
				assert.strictEqual(fetch?.request.method, "POST");
				assert.strictEqual(
					fetch?.request.headers.authorization,
					`Bearer ${user.token}`,
				);
				assert.strictEqual(fetch?.request.headers.accept, "application/json");
				assert.deepStrictEqual(fetch?.body, {
					statements: [{ field: 1, comparison: 0, value: String(user.id) }],
					combination: 1,
				});
			}),
	);

	it.effect("fetches volumes for a series with the seriesId param", () =>
		Effect.gen(function* () {
			const user = yield* sampleOne(KavitaUser);
			const seriesId = yield* sampleOne(Schema.Int);
			const volumes = wire(Volumes, yield* sampleOne(Volumes));
			const server = fakeServer((url) =>
				url.pathname === "/api/Plugin/authenticate" ||
				url.pathname === "/api/Account"
					? json(Schema.encodeSync(KavitaUser)(user))
					: url.pathname === "/api/Series/volumes"
						? json(volumes.body)
						: json({}, 404),
			);

			const result = yield* Effect.gen(function* () {
				return yield* (yield* KavitaClient).volumes(seriesId);
			}).pipe(Effect.provide(clientLayer(server.layer)));

			assert.deepStrictEqual(result, volumes.decoded);
			const call = server.received[2];
			assert.strictEqual(call?.request.method, "GET");
			assert.strictEqual(
				call?.url.searchParams.get("seriesId"),
				String(seriesId),
			);
			assert.strictEqual(
				call?.request.headers.authorization,
				`Bearer ${user.token}`,
			);
		}),
	);

	it.effect.each([401, 403])(
		"maps a %i from authenticate to KavitaAuthError",
		(status) =>
			Effect.gen(function* () {
				const server = fakeServer(() => json({}, status));
				const error = yield* Effect.flip(
					annotationsOf.pipe(Effect.provide(clientLayer(server.layer))),
				);
				assert.strictEqual(error._tag, "KavitaAuthError");
				if (error._tag === "KavitaAuthError") {
					assert.strictEqual(error.endpoint, "/api/Plugin/authenticate");
					assert.strictEqual(error.statusCode, status);
				}
			}),
	);

	const failingFetch = (response: () => Response | undefined) =>
		Effect.gen(function* () {
			const user = yield* sampleOne(KavitaUser);
			const server = fakeServer((url) =>
				url.pathname === "/api/Plugin/authenticate" ||
				url.pathname === "/api/Account"
					? json(Schema.encodeSync(KavitaUser)(user))
					: response(),
			);
			return yield* Effect.flip(
				annotationsOf.pipe(Effect.provide(clientLayer(server.layer))),
			);
		});

	it.effect("maps a 401 on a later call to KavitaAuthError", () =>
		Effect.gen(function* () {
			const error = yield* failingFetch(() => json({}, 401));
			assert.strictEqual(error._tag, "KavitaAuthError");
			if (error._tag === "KavitaAuthError") {
				assert.strictEqual(error.endpoint, "/api/Annotation/all-filtered");
				assert.strictEqual(error.statusCode, 401);
			}
		}),
	);

	it.effect("maps a 500 to KavitaNetworkError with the status", () =>
		Effect.gen(function* () {
			const error = yield* failingFetch(() => json({}, 500));
			assert.strictEqual(error._tag, "KavitaNetworkError");
			if (error._tag === "KavitaNetworkError") {
				assert.strictEqual(error.statusCode, 500);
				assert.strictEqual(error.endpoint, "/api/Annotation/all-filtered");
			}
		}),
	);

	it.effect(
		"maps a transport failure to KavitaNetworkError without a status",
		() =>
			Effect.gen(function* () {
				const error = yield* failingFetch(() => undefined);
				assert.strictEqual(error._tag, "KavitaNetworkError");
				if (error._tag === "KavitaNetworkError") {
					assert.isUndefined(error.statusCode);
					assert.isDefined(error.cause);
				}
			}),
	);

	it.effect("maps an invalid JSON body to KavitaParseError", () =>
		Effect.gen(function* () {
			const error = yield* failingFetch(
				() =>
					new Response("not json", {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
			);
			assert.strictEqual(error._tag, "KavitaParseError");
		}),
	);

	it.effect("maps a schema-mismatched body to KavitaParseError", () =>
		Effect.gen(function* () {
			const error = yield* failingFetch(() => json([{ id: "nope" }]));
			assert.strictEqual(error._tag, "KavitaParseError");
			if (error._tag === "KavitaParseError") {
				assert.strictEqual(error.endpoint, "/api/Annotation/all-filtered");
			}
		}),
	);

	it.effect("toKavitaError maps a SchemaError to KavitaParseError", () =>
		Effect.gen(function* () {
			const schemaError = yield* Effect.flip(
				Schema.decodeUnknownEffect(KavitaUser)({}),
			);
			const error = toKavitaError("/x")(schemaError);
			assert.strictEqual(error._tag, "KavitaParseError");
			assert.strictEqual(error.endpoint, "/x");
		}),
	);
});
