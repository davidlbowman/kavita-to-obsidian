/**
 * Obsidian-compatible HTTP client using requestUrl to bypass CORS.
 *
 * @module
 */
import {
	HttpClient,
	HttpClientError,
	HttpClientResponse,
} from "@effect/platform";
import { Effect, Layer } from "effect";
import { requestUrl } from "obsidian";

/**
 * Create an HTTP client layer that uses Obsidian's requestUrl API.
 *
 * This bypasses CORS restrictions that would otherwise block requests
 * from the Obsidian app to localhost or other origins.
 *
 * @since 0.0.1
 * @category Layers
 */
export const ObsidianHttpClient = Layer.succeed(
	HttpClient.HttpClient,
	HttpClient.make((request) =>
		Effect.tryPromise({
			try: async () => {
				const url = request.url;

				const headers: Record<string, string> = {};
				for (const [key, value] of Object.entries(request.headers)) {
					if (typeof key === "string" && typeof value === "string") {
						headers[key] = value;
					}
				}

				let body: string | ArrayBuffer | undefined;
				const bodyTag = request.body._tag;

				if (bodyTag === "Uint8Array") {
					body = new TextDecoder().decode(
						(request.body as { body: Uint8Array }).body,
					);
				} else if (bodyTag === "Raw") {
					const rawBody = (request.body as { body: unknown }).body;
					if (typeof rawBody === "string") {
						body = rawBody;
					} else if (rawBody instanceof Uint8Array) {
						body = new TextDecoder().decode(rawBody);
					} else if (rawBody instanceof ArrayBuffer) {
						body = rawBody;
					}
				}

				const contentType = headers["content-type"] ?? headers["Content-Type"];

				const filteredHeaders: Record<string, string> = {};
				for (const [key, value] of Object.entries(headers)) {
					const lowerKey = key.toLowerCase();
					if (lowerKey !== "content-type" && lowerKey !== "content-length") {
						filteredHeaders[key] = value;
					}
				}

				const requestOptions: Parameters<typeof requestUrl>[0] = {
					url,
					method: request.method,
					headers: filteredHeaders,
					throw: false,
				};

				if (body !== undefined) {
					requestOptions.body = body;
					if (contentType) {
						requestOptions.contentType = contentType;
					}
				}

				const response = await requestUrl(requestOptions);

				let responseBody: string;
				try {
					responseBody = response.text;
				} catch {
					responseBody = "";
				}

				return HttpClientResponse.fromWeb(
					request,
					new Response(responseBody, {
						status: response.status,
						headers: response.headers,
					}),
				);
			},
			catch: (error) =>
				new HttpClientError.RequestError({
					request,
					reason: "Transport",
					cause: error,
				}),
		}),
	),
);
