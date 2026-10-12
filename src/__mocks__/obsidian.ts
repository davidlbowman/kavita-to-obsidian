/**
 * Runtime stand-in for the `obsidian` module under Vitest.
 *
 * Types still come from the real `obsidian` package; this module only
 * supplies the runtime values the plugin touches outside Obsidian.
 *
 * @module
 */
import type { RequestUrlParam, RequestUrlResponse } from "obsidian";
import { vi } from "vitest";
import { parse, stringify } from "yaml";

/**
 * Replaced per test with a fake or fetch-backed implementation.
 *
 * @since 0.0.1
 * @category Mocks
 */
export const requestUrl =
	vi.fn<(param: RequestUrlParam) => Promise<RequestUrlResponse>>();

/**
 * Every notice shown since the last {@link clearCapturedNotices}.
 *
 * @since 1.2.0
 * @category Mocks
 */
export const capturedNotices: Array<{ message: string; timeout?: number }> = [];

/**
 * @since 1.2.0
 * @category Mocks
 */
export const clearCapturedNotices = (): void => {
	capturedNotices.length = 0;
};

/**
 * Records its message instead of rendering.
 *
 * @since 1.2.0
 * @category Mocks
 */
export class Notice {
	constructor(message: string, timeout?: number) {
		capturedNotices.push({ message, timeout });
	}
}

/**
 * Mirrors Obsidian's `normalizePath`.
 *
 * @since 0.0.1
 * @category Mocks
 */
export const normalizePath = (path: string): string =>
	path
		.replace(/\u00a0|\u202f/g, " ")
		.replace(/[\\/]+/g, "/")
		.replace(/^\/|\/$/g, "")
		.normalize("NFC") || "/";

/**
 * @since 2.0.0
 * @category Mocks
 */
export class TAbstractFile {
	path = "";
	name = "";
	parent: TFolder | null = null;
}

/**
 * @since 2.0.0
 * @category Mocks
 */
export class TFile extends TAbstractFile {
	basename = "";
	extension = "";
	stat = { ctime: 0, mtime: 0, size: 0 };
}

/**
 * @since 2.0.0
 * @category Mocks
 */
export class TFolder extends TAbstractFile {
	children: Array<TAbstractFile> = [];
	isRoot(): boolean {
		return this.parent === null;
	}
}

/**
 * Mirrors Obsidian's `parseYaml`.
 *
 * @since 2.0.0
 * @category Mocks
 */
export const parseYaml = (yaml: string): unknown => parse(yaml);

/**
 * Mirrors Obsidian's `stringifyYaml`.
 *
 * @since 2.0.0
 * @category Mocks
 */
export const stringifyYaml = (value: unknown): string => stringify(value);
