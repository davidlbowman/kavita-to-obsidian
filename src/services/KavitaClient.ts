/**
 * Read-only Kavita API client for the data a sync needs.
 *
 * @module
 */
import { Context, Effect, flow, Layer, Redacted, type Schema } from "effect";
import {
	HttpClient,
	type HttpClientError,
	HttpClientRequest,
	HttpClientResponse,
} from "effect/http";
import {
	KavitaAuthError,
	type KavitaError,
	KavitaNetworkError,
	KavitaParseError,
} from "../errors.js";
import {
	type Annotation,
	Annotations,
	CurrentUser,
	PluginSession,
	type Volume,
	Volumes,
} from "../schemas.js";
import { PluginConfig } from "./PluginConfig.js";

/**
 * Name this plugin reports to Kavita when exchanging the auth key.
 *
 * @since 2.0.0
 * @category Constants
 */
export const PLUGIN_NAME = "kavita-to-obsidian";

const OWNER_FILTER_FIELD = 1;
const EQUAL_COMPARISON = 0;
const AND_COMBINATION = 1;

/**
 * Map an HTTP or decoding failure on `endpoint` to a Kavita error.
 *
 * @since 2.0.0
 * @category Errors
 */
export const toKavitaError =
	(endpoint: string) =>
	(
		error: HttpClientError.HttpClientError | Schema.SchemaError,
	): KavitaError => {
		if (error._tag === "SchemaError") {
			return new KavitaParseError({ endpoint, cause: error });
		}
		if (error.reason._tag === "DecodeError") {
			return new KavitaParseError({ endpoint, cause: error });
		}
		const status = error.response?.status;
		if (status === 401 || status === 403) {
			return new KavitaAuthError({ endpoint, statusCode: status });
		}
		return new KavitaNetworkError({
			endpoint,
			cause: error,
			...(status === undefined ? {} : { statusCode: status }),
		});
	};

/**
 * Kavita API client.
 *
 * Exchanges the configured auth key for a session token and resolves the
 * user it belongs to when built, then reads that user's annotations and
 * volume metadata. Other users' shared annotations are never returned.
 *
 * @since 0.0.1
 * @category Services
 */
export class KavitaClient extends Context.Service<
	KavitaClient,
	{
		readonly annotations: Effect.Effect<ReadonlyArray<Annotation>, KavitaError>;
		readonly volumes: (
			seriesId: number,
		) => Effect.Effect<ReadonlyArray<Volume>, KavitaError>;
	}
>()("kavita-to-obsidian/KavitaClient") {
	/**
	 * Requires a `PluginConfig` and an `HttpClient`.
	 *
	 * @since 0.0.1
	 * @category Layers
	 */
	static readonly layerNoDeps = Layer.effect(
		KavitaClient,
		Effect.gen(function* () {
			const config = yield* PluginConfig;
			const http = (yield* HttpClient.HttpClient).pipe(
				HttpClient.mapRequest(
					flow(
						HttpClientRequest.prependUrl(config.kavitaUrl.href),
						HttpClientRequest.acceptJson,
					),
				),
				HttpClient.filterStatusOk,
			);

			const request = <S extends Schema.Decoder<unknown>>(
				endpoint: string,
				client: HttpClient.HttpClient,
				req: HttpClientRequest.HttpClientRequest,
				schema: S,
			) =>
				client
					.execute(req)
					.pipe(
						Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
						Effect.mapError(toKavitaError(endpoint)),
					);

			const session = yield* request(
				"/api/Plugin/authenticate",
				http,
				HttpClientRequest.post("/api/Plugin/authenticate").pipe(
					HttpClientRequest.setUrlParams({
						apiKey: Redacted.value(config.kavitaApiKey),
						pluginName: PLUGIN_NAME,
					}),
				),
				PluginSession,
			);

			const authed = http.pipe(
				HttpClient.mapRequest(HttpClientRequest.bearerToken(session.token)),
			);

			const user = yield* request(
				"/api/Account",
				authed,
				HttpClientRequest.get("/api/Account"),
				CurrentUser,
			);

			const annotations = request(
				"/api/Annotation/all-filtered",
				authed,
				HttpClientRequest.post("/api/Annotation/all-filtered").pipe(
					HttpClientRequest.bodyJsonUnsafe({
						statements: [
							{
								field: OWNER_FILTER_FIELD,
								comparison: EQUAL_COMPARISON,
								value: String(user.id),
							},
						],
						combination: AND_COMBINATION,
					}),
				),
				Annotations,
			).pipe(
				Effect.map((all) => all.filter((a) => a.ownerUserId === user.id)),
				Effect.withSpan("KavitaClient.annotations"),
			);

			const volumes = Effect.fn("KavitaClient.volumes")(function* (
				seriesId: number,
			) {
				return yield* request(
					"/api/Series/volumes",
					authed,
					HttpClientRequest.get("/api/Series/volumes").pipe(
						HttpClientRequest.setUrlParams({ seriesId: String(seriesId) }),
					),
					Volumes,
				);
			});

			return KavitaClient.of({ annotations, volumes });
		}),
	);
}
