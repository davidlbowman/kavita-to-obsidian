/**
 * A `requestUrl` stand-in backed by `fetch`, so live tests drive the plugin's
 * real `ObsidianHttpClient` against a real server.
 *
 * @module
 */
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";

/**
 * Perform the request like Obsidian's `requestUrl({ throw: false })`.
 *
 * @since 2.0.0
 * @category Test Support
 */
export const fetchRequestUrl = async (
	param: RequestUrlParam,
): Promise<RequestUrlResponse> => {
	const headers = new Headers(param.headers);
	if (param.contentType !== undefined) {
		headers.set("content-type", param.contentType);
	}
	const response = await fetch(param.url, {
		method: param.method ?? "GET",
		headers,
		...(param.body === undefined ? {} : { body: param.body }),
	});
	const arrayBuffer = await response.arrayBuffer();
	const text = new TextDecoder().decode(arrayBuffer);
	return {
		status: response.status,
		headers: Object.fromEntries(response.headers.entries()),
		arrayBuffer,
		text,
		get json(): unknown {
			return JSON.parse(text);
		},
	};
};
