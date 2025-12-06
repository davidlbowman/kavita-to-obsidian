/**
 * Kavita API client service for fetching annotations.
 *
 * @module
 */
import {
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Effect, Redacted } from "effect";
import { KavitaNetworkError } from "../errors.js";
import {
	AnnotationsResponse,
	type BrowseAnnotationFilterDto,
} from "../schemas.js";
import { PluginConfig } from "./PluginConfig.js";

/**
 * Kavita API client service.
 *
 * Provides methods to fetch annotations from a Kavita server.
 *
 * @since 0.0.1
 * @category Services
 */
export class KavitaClient extends Effect.Service<KavitaClient>()(
	"KavitaClient",
	{
		effect: Effect.gen(function* () {
			const httpClient = yield* HttpClient.HttpClient;
			const config = yield* PluginConfig;

			const client = httpClient.pipe(
				HttpClient.filterStatusOk,
				HttpClient.mapRequest(
					HttpClientRequest.prependUrl(config.kavitaUrl.href),
				),
				HttpClient.mapRequest(
					HttpClientRequest.setHeader(
						"x-api-key",
						Redacted.value(config.kavitaApiKey),
					),
				),
			);

			/**
			 * Fetch all annotations without filtering.
			 *
			 * @since 0.0.1
			 */
			const fetchAllAnnotations = Effect.gen(function* () {
				const request = HttpClientRequest.post("/api/Annotation/all-filtered");
				const response = yield* client.execute(request);
				return yield* HttpClientResponse.schemaBodyJson(AnnotationsResponse)(
					response,
				);
			}).pipe(
				Effect.mapError(
					(e) =>
						new KavitaNetworkError({
							url: "/api/Annotation/all-filtered",
							cause: e,
						}),
				),
				Effect.scoped,
			);

			/**
			 * Fetch annotations with filtering options.
			 *
			 * @since 0.0.1
			 */
			const fetchAnnotationsFiltered = (
				filter: typeof BrowseAnnotationFilterDto.Type,
			) =>
				Effect.gen(function* () {
					const request = HttpClientRequest.post(
						"/api/Annotation/all-filtered",
					).pipe(HttpClientRequest.bodyUnsafeJson(filter));
					const response = yield* client.execute(request);
					return yield* HttpClientResponse.schemaBodyJson(AnnotationsResponse)(
						response,
					);
				}).pipe(
					Effect.mapError(
						(e) =>
							new KavitaNetworkError({
								url: "/api/Annotation/all-filtered",
								cause: e,
							}),
					),
					Effect.scoped,
				);

			return { fetchAllAnnotations, fetchAnnotationsFiltered };
		}),
		dependencies: [PluginConfig.Default],
	},
) {}

/**
 * Live layer for KavitaClient with HTTP client.
 *
 * @since 0.0.1
 * @category Layers
 */
export const KavitaClientLive = KavitaClient.Default;
