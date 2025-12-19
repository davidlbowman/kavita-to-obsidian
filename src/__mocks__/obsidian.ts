/**
 * Mock for Obsidian module in tests.
 *
 * @module
 */

import { vi } from "vitest";

export const requestUrl = vi.fn();

/**
 * Mock normalizePath that mimics Obsidian's path normalization.
 * Replaces backslashes with forward slashes and removes duplicate slashes.
 */
export const normalizePath = (path: string): string => {
	return path
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/^\/|\/$/g, "");
};

export class App {
	vault = {
		adapter: {
			write: vi.fn(),
			read: vi.fn(),
		},
	};
}
