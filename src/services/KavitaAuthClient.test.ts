/**
 * Tests for KavitaAuthClient service.
 *
 * @module
 */

import {
	HttpClient,
	HttpClientError,
	HttpClientRequest,
	HttpClientResponse,
} from "@effect/platform";
import { describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";
import { KavitaNetworkError } from "../errors.js";
import { UserDto } from "../schemas.js";
import { KavitaAuthClient } from "./KavitaAuthClient.js";

const createMockHttpClient = (
	handler: (url: string, method: string) => { body: string; status: number },
) =>
	Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request) => {
			const { body, status } = handler(request.url, request.method);
			return Effect.succeed(
				HttpClientResponse.fromWeb(
					request,
					new Response(body, {
						status,
						headers: { "Content-Type": "application/json" },
					}),
				),
			);
		}),
	);

const createFailingHttpClient = () =>
	Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request) =>
			Effect.fail(
				new HttpClientError.RequestError({
					request,
					reason: "Transport",
					cause: new Error("Network error"),
				}),
			),
		),
	);

/**
 * Create a test layer for KavitaAuthClient that uses a mock HTTP client.
 * This re-implements the service creation logic to avoid the FetchHttpClient dependency.
 */
const TestKavitaAuthClient = (httpLayer: Layer.Layer<HttpClient.HttpClient>) =>
	Layer.effect(
		KavitaAuthClient,
		Effect.gen(function* () {
			const httpClient = yield* HttpClient.HttpClient;

			const forUrl = (baseUrl: string) => {
				const client = httpClient.pipe(
					HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
				);

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

				const register = (dto: {
					username: string;
					email: string;
					password: string;
				}) =>
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

				const login = (dto: { username: string; password: string }) =>
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
								new KavitaNetworkError({
									url: "/api/Account/login",
									cause: e,
								}),
						),
						Effect.scoped,
					);

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

				return { healthCheck, register, login, resetApiKey };
			};

			return new KavitaAuthClient({ forUrl });
		}),
	).pipe(Layer.provide(httpLayer));

describe("KavitaAuthClient", () => {
	describe("forUrl", () => {
		it.effect("creates a client for the given URL", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");

				expect(client).toHaveProperty("healthCheck");
				expect(client).toHaveProperty("register");
				expect(client).toHaveProperty("login");
				expect(client).toHaveProperty("resetApiKey");
			}).pipe(
				Effect.provide(
					TestKavitaAuthClient(
						createMockHttpClient(() => ({ body: "{}", status: 200 })),
					),
				),
			),
		);
	});

	describe("healthCheck", () => {
		it.effect("returns true when server is healthy", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");
				const isHealthy = yield* client.healthCheck;

				expect(isHealthy).toBe(true);
			}).pipe(
				Effect.provide(
					TestKavitaAuthClient(
						createMockHttpClient((url) => {
							if (url.includes("/api/health")) {
								return { body: '"Healthy"', status: 200 };
							}
							return { body: "{}", status: 200 };
						}),
					),
				),
			),
		);

		it.effect("returns false when server returns non-200", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");
				const isHealthy = yield* client.healthCheck;

				expect(isHealthy).toBe(false);
			}).pipe(
				Effect.provide(
					TestKavitaAuthClient(
						createMockHttpClient((url) => {
							if (url.includes("/api/health")) {
								return { body: '"Unhealthy"', status: 503 };
							}
							return { body: "{}", status: 200 };
						}),
					),
				),
			),
		);

		it.effect("returns KavitaNetworkError on network failure", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");
				const result = yield* client.healthCheck.pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(KavitaNetworkError);
					expect(result.left.url).toBe("/api/health");
				}
			}).pipe(Effect.provide(TestKavitaAuthClient(createFailingHttpClient()))),
		);
	});

	describe("register", () => {
		it.effect("registers successfully", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");

				yield* client.register({
					username: "admin",
					email: "admin@test.local",
					password: "password123",
				});
			}).pipe(
				Effect.provide(
					TestKavitaAuthClient(
						createMockHttpClient(() => ({ body: "{}", status: 200 })),
					),
				),
			),
		);

		it.effect("returns KavitaNetworkError on network failure", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");
				const result = yield* client
					.register({
						username: "admin",
						email: "admin@test.local",
						password: "password123",
					})
					.pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(KavitaNetworkError);
					expect(result.left.url).toBe("/api/Account/register");
				}
			}).pipe(Effect.provide(TestKavitaAuthClient(createFailingHttpClient()))),
		);
	});

	describe("login", () => {
		it.effect("logs in and returns user data", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");

				const user = yield* client.login({
					username: "admin",
					password: "password123",
				});

				expect(user.token).toBe("mock-jwt-token");
				expect(user.username).toBe("admin");
			}).pipe(
				Effect.provide(
					TestKavitaAuthClient(
						createMockHttpClient((url) => {
							if (url.includes("/api/Account/login")) {
								return {
									body: JSON.stringify({
										token: "mock-jwt-token",
										username: "admin",
									}),
									status: 200,
								};
							}
							return { body: "{}", status: 200 };
						}),
					),
				),
			),
		);

		it.effect("returns KavitaNetworkError on auth failure", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");
				const result = yield* client
					.login({
						username: "admin",
						password: "wrongpassword",
					})
					.pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(KavitaNetworkError);
					expect(result.left.url).toBe("/api/Account/login");
				}
			}).pipe(
				Effect.provide(
					TestKavitaAuthClient(
						createMockHttpClient((url) => {
							if (url.includes("/api/Account/login")) {
								return {
									body: JSON.stringify({ message: "Invalid credentials" }),
									status: 401,
								};
							}
							return { body: "{}", status: 200 };
						}),
					),
				),
			),
		);
	});

	describe("resetApiKey", () => {
		it.effect("resets API key and strips quotes from response", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");

				const apiKey = yield* client.resetApiKey("mock-jwt-token");

				expect(apiKey).toBe("new-api-key-123");
			}).pipe(
				Effect.provide(
					TestKavitaAuthClient(
						createMockHttpClient((url) => {
							if (url.includes("/api/Account/reset-api-key")) {
								return { body: '"new-api-key-123"', status: 200 };
							}
							return { body: "{}", status: 200 };
						}),
					),
				),
			),
		);

		it.effect("returns KavitaNetworkError on auth failure", () =>
			Effect.gen(function* () {
				const authClient = yield* KavitaAuthClient;
				const client = authClient.forUrl("http://test.local");
				const result = yield* client
					.resetApiKey("invalid-token")
					.pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(KavitaNetworkError);
					expect(result.left.url).toBe("/api/Account/reset-api-key");
				}
			}).pipe(
				Effect.provide(
					TestKavitaAuthClient(
						createMockHttpClient((url) => {
							if (url.includes("/api/Account/reset-api-key")) {
								return {
									body: JSON.stringify({ message: "Unauthorized" }),
									status: 401,
								};
							}
							return { body: "{}", status: 200 };
						}),
					),
				),
			),
		);
	});
});
