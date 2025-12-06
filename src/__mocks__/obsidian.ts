/**
 * Mock for Obsidian module in tests.
 *
 * @module
 */

import { vi } from "vitest";

export const requestUrl = vi.fn();

export class App {
	vault = {
		adapter: {
			write: vi.fn(),
			read: vi.fn(),
		},
	};
}
