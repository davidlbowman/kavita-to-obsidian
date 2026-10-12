/**
 * `HttpClient` backed by Obsidian's `requestUrl`, which bypasses CORS.
 *
 * @module
 */
import { Effect, Layer, Predicate } from "effect";
import {
	type HttpBody,
	HttpClient,
	HttpClientError,
	type HttpClientRequest,
	HttpClientResponse,
} from "effect/http";
import { type RequestUrlParam, requestUrl } from "obsidian";

const NULL_BODY_STATUSES: ReadonlySet<number> = new Set([101, 204, 205, 304]);

const OMITTED_HEADERS: ReadonlySet<string> = new Set([
	"content-type",
	"content-length",
]);

const transportError = (
	request: HttpClientRequest.HttpClientRequest,
	description: string,
	cause?: unknown,
) =>
	new HttpClientError.HttpClientError({
		reason: new HttpClientError.TransportError({ request, description, cause }),
	});

const toRequestBody = (
	body: HttpBody.HttpBody,
): string | ArrayBuffer | undefined | null => {
	switch (body._tag) {
		case "Empty":
			return undefined;
		case "Uint8Array":
			return body.text ?? new TextDecoder().decode(body.body);
		case "Raw":
			if (Predicate.isString(body.body)) return body.body;
			if (body.body instanceof Uint8Array)
				return new TextDecoder().decode(body.body);
			if (body.body instanceof ArrayBuffer) return body.body;
			return null;
		default:
			return null;
	}
};

const contentTypeOf = (body: HttpBody.HttpBody): string | undefined => {
	switch (body._tag) {
		case "Uint8Array":
		case "Raw":
			return body.contentType;
		default:
			return undefined;
	}
};

/**
 * Translate an Effect request into `requestUrl` parameters.
 *
 * Fails for body types `requestUrl` cannot send (streams, form data).
 *
 * @since 2.0.0
 * @category Internals
 */
export const toRequestUrlParam = (
	request: HttpClientRequest.HttpClientRequest,
	url: URL,
): Effect.Effect<RequestUrlParam, HttpClientError.HttpClientError> => {
	const body = toRequestBody(request.body);
	if (body === null) {
		return Effect.fail(
			transportError(
				request,
				`requestUrl cannot send a ${request.body._tag} body`,
			),
		);
	}
	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(request.headers)) {
		if (!OMITTED_HEADERS.has(key.toLowerCase())) {
			headers[key] = value;
		}
	}
	const contentType =
		contentTypeOf(request.body) ?? request.headers["content-type"];
	return Effect.succeed({
		url: url.href,
		method: request.method,
		headers,
		throw: false,
		...(body === undefined ? {} : { body }),
		...(body === undefined || contentType === undefined ? {} : { contentType }),
	});
};

/**
 * `HttpClient` layer that sends every request through `requestUrl`.
 *
 * @since 0.0.1
 * @category Layers
 */
export const ObsidianHttpClient = Layer.succeed(
	HttpClient.HttpClient,
	HttpClient.make((request, url) =>
		Effect.gen(function* () {
			const param = yield* toRequestUrlParam(request, url);
			const response = yield* Effect.tryPromise({
				try: () => requestUrl(param),
				catch: (cause) => transportError(request, "requestUrl failed", cause),
			});
			const body = NULL_BODY_STATUSES.has(response.status)
				? null
				: response.arrayBuffer;
			return HttpClientResponse.fromWeb(
				request,
				new Response(body, {
					status: response.status,
					headers: response.headers,
				}),
			);
		}),
	),
);
