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

/**
 * Captured notices for testing.
 */
export const capturedNotices: Array<{ message: string; timeout?: number }> = [];

/**
 * Mock Notice class that captures notices for testing.
 */
export class Notice {
	constructor(message: string, timeout?: number) {
		capturedNotices.push({ message, timeout });
	}
}

/**
 * Clear captured notices between tests.
 */
export const clearCapturedNotices = (): void => {
	capturedNotices.length = 0;
};

export class App {
	vault = {
		adapter: {
			write: vi.fn(),
			read: vi.fn(),
		},
	};
}
