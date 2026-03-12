/**
 * Kavita API client service for fetching annotations.
 *
 * @module
 */
import { Effect, Layer, Redacted, Schema, ServiceMap } from "effect";
import {
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from "effect/unstable/http";
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
	SeriesMetadataDto,
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
export class KavitaClient extends ServiceMap.Service<
	KavitaClient,
	{
		readonly fetchAllAnnotations: Effect.Effect<
			typeof AnnotationsResponse.Type,
			KavitaNetworkError
		>;
		fetchAnnotationsFiltered(
			filter: typeof BrowseAnnotationFilterDto.Type,
		): Effect.Effect<typeof AnnotationsResponse.Type, KavitaNetworkError>;
		createAnnotation(
			annotation: typeof CreateAnnotationDto.Encoded,
		): Effect.Effect<typeof AnnotationDto.Type, KavitaNetworkError>;
		readonly getLibraries: Effect.Effect<
			ReadonlyArray<typeof LibraryDto.Type>,
			KavitaNetworkError
		>;
		createLibrary(
			library: typeof CreateLibraryDto.Type,
		): Effect.Effect<void, KavitaNetworkError>;
		readonly scanAllLibraries: Effect.Effect<void, KavitaNetworkError>;
		scanLibrary(
			libraryId: number,
			force?: boolean,
		): Effect.Effect<void, KavitaNetworkError>;
		readonly getAllSeries: Effect.Effect<
			ReadonlyArray<typeof SeriesDto.Type>,
			KavitaNetworkError
		>;
		getVolumes(
			seriesId: number,
		): Effect.Effect<ReadonlyArray<typeof VolumeDto.Type>, KavitaNetworkError>;
		getSeriesMetadata(
			seriesId: number,
		): Effect.Effect<typeof SeriesMetadataDto.Type, KavitaNetworkError>;
	}
>()("KavitaClient") {
	/**
	 * Create the KavitaClient service implementation.
	 *
	 * @since 0.0.1
	 * @category Constructors
	 */
	static readonly make = Effect.gen(function* () {
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
						"reason" in e &&
						e.reason._tag === "StatusCodeError" &&
						"response" in e.reason
					) {
						const status = (e.reason as { response: { status: number } })
							.response.status;
						if (status === 401 || status === 403) {
							return new KavitaAuthError({ reason: "Invalid API key" });
						}
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
			).pipe(HttpClientRequest.bodyJsonUnsafe({}));
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
				).pipe(HttpClientRequest.bodyJsonUnsafe(filter));
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
			return yield* HttpClientResponse.schemaBodyJson(Schema.Array(LibraryDto))(
				response,
			);
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
					HttpClientRequest.bodyJsonUnsafe(library),
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
					(e) => new KavitaNetworkError({ url: "/api/Library/scan", cause: e }),
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
				HttpClientRequest.bodyJsonUnsafe({}),
			);
			const response = yield* client.execute(request);
			const data = yield* HttpClientResponse.schemaBodyJson(
				Schema.Union([Schema.Array(SeriesDto), SeriesPagedResponse]),
			)(response);
			if ("result" in data) {
				return data.result;
			}
			return data;
		}).pipe(
			Effect.mapError(
				(e) => new KavitaNetworkError({ url: "/api/Series/all-v2", cause: e }),
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
		const createAnnotation = (annotation: typeof CreateAnnotationDto.Encoded) =>
			Effect.gen(function* () {
				const request = HttpClientRequest.post("/api/Annotation/create").pipe(
					HttpClientRequest.bodyJsonUnsafe(annotation),
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

		/**
		 * Get metadata for a series (authors, genres, tags, etc.).
		 *
		 * @since 0.0.2
		 */
		const getSeriesMetadata = (seriesId: number) =>
			Effect.gen(function* () {
				const request = HttpClientRequest.get(
					`/api/Series/metadata?seriesId=${seriesId}`,
				);
				const response = yield* client.execute(request);
				return yield* HttpClientResponse.schemaBodyJson(SeriesMetadataDto)(
					response,
				);
			}).pipe(
				Effect.mapError(
					(e) =>
						new KavitaNetworkError({
							url: `/api/Series/metadata?seriesId=${seriesId}`,
							cause: e,
						}),
				),
				Effect.scoped,
			);

		return KavitaClient.of({
			fetchAllAnnotations,
			fetchAnnotationsFiltered,
			createAnnotation,
			getLibraries,
			createLibrary,
			scanAllLibraries,
			scanLibrary,
			getAllSeries,
			getVolumes,
			getSeriesMetadata,
		});
	});

	/**
	 * Layer that creates the KavitaClient (without providing dependencies).
	 *
	 * @since 0.0.1
	 * @category Layers
	 */
	static readonly layer = Layer.effect(KavitaClient, KavitaClient.make);

	/**
	 * Layer without dependencies provided (alias for composition).
	 *
	 * @since 0.0.1
	 * @category Layers
	 */
	static readonly layerNoDeps = KavitaClient.layer;
}
