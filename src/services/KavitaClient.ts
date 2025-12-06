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
import { Effect, Redacted, Schema } from "effect";
import {
	KavitaAuthError,
	KavitaNetworkError,
	KavitaParseError,
} from "../errors.js";
import {
	AnnotationDto,
	AnnotationsResponse,
	type BrowseAnnotationFilterDto,
	type CreateAnnotationDto,
	type CreateLibraryDto,
	LibraryDto,
	SeriesDto,
	SeriesPagedResponse,
	VolumeDto,
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
		accessors: true,
		effect: Effect.gen(function* () {
			const httpClient = yield* HttpClient.HttpClient;
			const config = yield* PluginConfig;

			const baseClient = httpClient.pipe(
				HttpClient.mapRequest(
					HttpClientRequest.prependUrl(config.kavitaUrl.href),
				),
			);

			const apiKey = Redacted.value(config.kavitaApiKey);
			const authRequest = HttpClientRequest.post(
				`/api/Plugin/authenticate?apiKey=${encodeURIComponent(apiKey)}&pluginName=kavita-to-obsidian`,
			);
			const authResponse = yield* baseClient
				.pipe(HttpClient.filterStatusOk)
				.execute(authRequest)
				.pipe(
					Effect.mapError((e) => {
						if (
							e._tag === "ResponseError" &&
							(e.response.status === 401 || e.response.status === 403)
						) {
							return new KavitaAuthError({ reason: "Invalid API key" });
						}
						return new KavitaNetworkError({
							url: "/api/Plugin/authenticate",
							cause: e,
						});
					}),
					Effect.scoped,
				);

			const jwtToken = yield* HttpClientResponse.schemaBodyJson(
				Schema.Struct({ token: Schema.String }),
			)(authResponse).pipe(
				Effect.map((r) => r.token),
				Effect.mapError(
					() =>
						new KavitaParseError({
							expected: "{ token: string }",
						}),
				),
			);

			const client = httpClient.pipe(
				HttpClient.filterStatusOk,
				HttpClient.mapRequest(
					HttpClientRequest.prependUrl(config.kavitaUrl.href),
				),
				HttpClient.mapRequest(
					HttpClientRequest.setHeader("Authorization", `Bearer ${jwtToken}`),
				),
			);

			/**
			 * Fetch all annotations without filtering.
			 *
			 * @since 0.0.1
			 */
			const fetchAllAnnotations = Effect.gen(function* () {
				const request = HttpClientRequest.post(
					"/api/Annotation/all-filtered",
				).pipe(HttpClientRequest.bodyUnsafeJson({}));
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

			/**
			 * Get all libraries.
			 *
			 * @since 0.0.1
			 */
			const getLibraries = Effect.gen(function* () {
				const request = HttpClientRequest.get("/api/Library/libraries");
				const response = yield* client.execute(request);
				return yield* HttpClientResponse.schemaBodyJson(
					Schema.Array(LibraryDto),
				)(response);
			}).pipe(
				Effect.mapError(
					(e) =>
						new KavitaNetworkError({ url: "/api/Library/libraries", cause: e }),
				),
				Effect.scoped,
			);

			/**
			 * Create a new library.
			 *
			 * @since 0.0.1
			 */
			const createLibrary = (library: typeof CreateLibraryDto.Type) =>
				Effect.gen(function* () {
					const request = HttpClientRequest.post("/api/Library/create").pipe(
						HttpClientRequest.bodyUnsafeJson(library),
					);
					yield* client.execute(request);
				}).pipe(
					Effect.mapError(
						(e) =>
							new KavitaNetworkError({ url: "/api/Library/create", cause: e }),
					),
					Effect.scoped,
				);

			/**
			 * Trigger a scan of all libraries.
			 *
			 * @since 0.0.1
			 */
			const scanAllLibraries = Effect.gen(function* () {
				const request = HttpClientRequest.post("/api/Library/scan-all");
				yield* client.execute(request);
			}).pipe(
				Effect.mapError(
					(e) =>
						new KavitaNetworkError({ url: "/api/Library/scan-all", cause: e }),
				),
				Effect.scoped,
			);

			/**
			 * Trigger a scan of a specific library.
			 *
			 * @since 0.0.1
			 */
			const scanLibrary = (libraryId: number, force = true) =>
				Effect.gen(function* () {
					const request = HttpClientRequest.post(
						`/api/Library/scan?libraryId=${libraryId}&force=${force}`,
					);
					yield* client.execute(request);
				}).pipe(
					Effect.mapError(
						(e) =>
							new KavitaNetworkError({ url: "/api/Library/scan", cause: e }),
					),
					Effect.scoped,
				);

			/**
			 * Get all series (paginated).
			 *
			 * Handles both array and paged response formats from the API.
			 *
			 * @since 0.0.1
			 */
			const getAllSeries = Effect.gen(function* () {
				const request = HttpClientRequest.post("/api/Series/all-v2").pipe(
					HttpClientRequest.bodyUnsafeJson({}),
				);
				const response = yield* client.execute(request);
				const data = yield* HttpClientResponse.schemaBodyJson(
					Schema.Union(Schema.Array(SeriesDto), SeriesPagedResponse),
				)(response);
				if ("result" in data) {
					return data.result;
				}
				return data;
			}).pipe(
				Effect.mapError(
					(e) =>
						new KavitaNetworkError({ url: "/api/Series/all-v2", cause: e }),
				),
				Effect.scoped,
			);

			/**
			 * Get volumes (with chapters) for a series.
			 *
			 * @since 0.0.1
			 */
			const getVolumes = (seriesId: number) =>
				Effect.gen(function* () {
					const request = HttpClientRequest.get(
						`/api/Series/volumes?seriesId=${seriesId}`,
					);
					const response = yield* client.execute(request);
					return yield* HttpClientResponse.schemaBodyJson(
						Schema.Array(VolumeDto),
					)(response);
				}).pipe(
					Effect.mapError(
						(e) =>
							new KavitaNetworkError({ url: "/api/Series/volumes", cause: e }),
					),
					Effect.scoped,
				);

			/**
			 * Create a new annotation.
			 *
			 * @since 0.0.1
			 */
			const createAnnotation = (
				annotation: typeof CreateAnnotationDto.Encoded,
			) =>
				Effect.gen(function* () {
					const request = HttpClientRequest.post("/api/Annotation/create").pipe(
						HttpClientRequest.bodyUnsafeJson(annotation),
					);
					const response = yield* client.execute(request);
					return yield* HttpClientResponse.schemaBodyJson(AnnotationDto)(
						response,
					);
				}).pipe(
					Effect.mapError(
						(e) =>
							new KavitaNetworkError({
								url: "/api/Annotation/create",
								cause: e,
							}),
					),
					Effect.scoped,
				);

			return {
				fetchAllAnnotations,
				fetchAnnotationsFiltered,
				createAnnotation,
				getLibraries,
				createLibrary,
				scanAllLibraries,
				scanLibrary,
				getAllSeries,
				getVolumes,
			};
		}),
		dependencies: [PluginConfig.Default],
	},
) {}
