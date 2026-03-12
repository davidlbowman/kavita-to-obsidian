/**
 * Mock for Obsidian module in tests.
 *
 * @module
 */

import { vi } from "vitest";

export const requestUrl = vi.fn();

/**
 * Captured Notice instances for test assertions.
 *
 * @since 1.2.0
 * @category Test Helpers
 */
export const capturedNotices: Array<{ message: string; timeout?: number }> = [];

/**
 * Reset captured notices between tests.
 *
 * @since 1.2.0
 * @category Test Helpers
 */
export const clearCapturedNotices = (): void => {
	capturedNotices.length = 0;
};

/**
 * Get a captured notice by index, throwing if not found.
 *
 * @since 1.2.0
 * @category Test Helpers
 */
export const getNotice = (
	index: number,
): { message: string; timeout?: number } => {
	const notice = capturedNotices[index];
	if (!notice) {
		throw new Error(
			`No notice at index ${index}. Have ${capturedNotices.length} notices.`,
		);
	}
	return notice;
};

/**
 * Mock Notice class that captures constructor calls for assertions.
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
