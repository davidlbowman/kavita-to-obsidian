/**
 * Kavita authentication client for bootstrapping (no API key required).
 *
 * @module
 */
import {
	FetchHttpClient,
	HttpClient,
	type HttpClientError,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { Effect } from "effect";
import { KavitaNetworkError } from "../errors.js";
import { type LoginDto, type RegisterDto, UserDto } from "../schemas.js";

/**
 * Kavita authentication client service.
 *
 * Provides methods for user registration, login, and API key management.
 * This client does not require an API key and is used for bootstrapping.
 *
 * @since 0.0.1
 * @category Services
 */
export class KavitaAuthClient extends Effect.Service<KavitaAuthClient>()(
	"KavitaAuthClient",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const httpClient = yield* HttpClient.HttpClient;

			/**
			 * Create an unauthenticated client for a given base URL.
			 *
			 * @since 0.0.1
			 */
			const forUrl = (baseUrl: string) => {
				const client = httpClient.pipe(
					HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
				);

				/**
				 * Check if Kavita server is healthy.
				 *
				 * @since 0.0.1
				 */
				const healthCheck = Effect.gen(function* () {
					const request = HttpClientRequest.get("/api/health");
					const response = yield* client.execute(request);
					return response.status === 200;
				}).pipe(
					Effect.mapError(
						(e) => new KavitaNetworkError({ url: "/api/health", cause: e }),
					),
					Effect.scoped,
				);

				/**
				 * Register a new admin user.
				 *
				 * @since 0.0.1
				 */
				const register = (dto: typeof RegisterDto.Type) =>
					Effect.gen(function* () {
						const request = HttpClientRequest.post(
							"/api/Account/register",
						).pipe(HttpClientRequest.bodyUnsafeJson(dto));
						yield* client.execute(request);
					}).pipe(
						Effect.scoped,
						Effect.catchIf(
							(e): e is HttpClientError.ResponseError =>
								e._tag === "ResponseError" && e.response.status === 409,
							() => Effect.void,
						),
						Effect.mapError(
							(e) =>
								new KavitaNetworkError({
									url: "/api/Account/register",
									cause: e,
								}),
						),
					);

				/**
				 * Login and get JWT token.
				 *
				 * @since 0.0.1
				 */
				const login = (dto: typeof LoginDto.Type) =>
					Effect.gen(function* () {
						const request = HttpClientRequest.post("/api/Account/login").pipe(
							HttpClientRequest.bodyUnsafeJson(dto),
						);
						const response = yield* client
							.pipe(HttpClient.filterStatusOk)
							.execute(request);
						return yield* HttpClientResponse.schemaBodyJson(UserDto)(response);
					}).pipe(
						Effect.mapError(
							(e) =>
								new KavitaNetworkError({ url: "/api/Account/login", cause: e }),
						),
						Effect.scoped,
					);

				/**
				 * Reset API key (requires JWT token).
				 *
				 * @since 0.0.1
				 */
				const resetApiKey = (token: string) =>
					Effect.gen(function* () {
						const request = HttpClientRequest.post(
							"/api/Account/reset-api-key",
						).pipe(
							HttpClientRequest.setHeader("Authorization", `Bearer ${token}`),
						);
						const response = yield* client
							.pipe(HttpClient.filterStatusOk)
							.execute(request);
						const text = yield* response.text;
						// API returns the key with quotes, strip them
						return text.replace(/"/g, "");
					}).pipe(
						Effect.mapError(
							(e) =>
								new KavitaNetworkError({
									url: "/api/Account/reset-api-key",
									cause: e,
								}),
						),
						Effect.scoped,
					);

				return {
					healthCheck,
					register,
					login,
					resetApiKey,
				};
			};

			return { forUrl };
		}),
		dependencies: [FetchHttpClient.layer],
	},
) {}
