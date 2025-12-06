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
				// Build the full URL
				const url = request.url;

				// Effect Headers is a Record<string, string> with a symbol
				// Filter out the symbol key for Obsidian's requestUrl
				const headers: Record<string, string> = {};
				for (const [key, value] of Object.entries(request.headers)) {
					if (typeof key === "string" && typeof value === "string") {
						headers[key] = value;
					}
				}

				// Get request body if present
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
				// For Empty body, leave undefined

				// Use Obsidian's requestUrl which bypasses CORS
				// contentType must be set explicitly for Obsidian
				const contentType = headers["content-type"] ?? headers["Content-Type"];

				// Remove content-type and content-length from headers
				// Obsidian's requestUrl handles these automatically
				const filteredHeaders: Record<string, string> = {};
				for (const [key, value] of Object.entries(headers)) {
					const lowerKey = key.toLowerCase();
					if (lowerKey !== "content-type" && lowerKey !== "content-length") {
						filteredHeaders[key] = value;
					}
				}

				// Build request options - only include body if defined
				const requestOptions: Parameters<typeof requestUrl>[0] = {
					url,
					method: request.method,
					headers: filteredHeaders,
					throw: false, // Don't throw on non-2xx status
				};

				// Only add body and contentType if we have a body
				if (body !== undefined) {
					requestOptions.body = body;
					if (contentType) {
						requestOptions.contentType = contentType;
					}
				}

				const response = await requestUrl(requestOptions);

				// Get response body - try text first, fallback to empty
				let responseBody: string;
				try {
					responseBody = response.text;
				} catch {
					responseBody = "";
				}

				// Convert to a Web Response that @effect/platform expects
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
