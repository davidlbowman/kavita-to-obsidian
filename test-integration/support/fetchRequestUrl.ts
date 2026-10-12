/**
 * A `requestUrl` stand-in for live tests, so they drive the plugin's real
 * `ObsidianHttpClient` against a real server.
 *
 * @module
 */
import { Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";

const toRequest = (param: RequestUrlParam) => {
	const request = HttpClientRequest.make(
		param.method === "POST"
			? "POST"
			: param.method === "DELETE"
				? "DELETE"
				: "GET",
	)(param.url).pipe(HttpClientRequest.setHeaders(param.headers ?? {}));
	if (param.body === undefined) return request;
	const contentType = param.contentType ?? "application/octet-stream";
	return typeof param.body === "string"
		? HttpClientRequest.bodyText(request, param.body, contentType)
		: HttpClientRequest.bodyUint8Array(
				request,
				new Uint8Array(param.body),
				contentType,
			);
};

/**
 * Perform the request like Obsidian's `requestUrl({ throw: false })`.
 *
 * @since 2.0.0
 * @category Test Support
 */
export const fetchRequestUrl = (
	param: RequestUrlParam,
): Promise<RequestUrlResponse> =>
	Effect.runPromise(
		Effect.gen(function* () {
			const client = yield* HttpClient.HttpClient;
			const response = yield* client.execute(toRequest(param));
			const arrayBuffer = yield* response.arrayBuffer;
			const text = new TextDecoder().decode(arrayBuffer);
			const result: RequestUrlResponse = {
				status: response.status,
				headers: { ...response.headers },
				arrayBuffer,
				text,
				get json(): unknown {
					const parsed: unknown = JSON.parse(text);
					return parsed;
				},
			};
			return result;
		}).pipe(Effect.provide(FetchHttpClient.layer)),
	);
