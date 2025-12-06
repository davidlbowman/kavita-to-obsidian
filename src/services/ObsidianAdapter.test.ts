/**
 * Tests for ObsidianAdapter service.
 *
 * @module
 */
import { describe, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { expect } from "vitest";
import { ObsidianFileNotFoundError, ObsidianWriteError } from "../errors.js";
import { ObsidianAdapter } from "./ObsidianAdapter.js";
import { ObsidianApp } from "./ObsidianApp.js";

interface MockFile {
	path: string;
	extension: string;
}

interface MockVault {
	getAbstractFileByPath: (path: string) => MockFile | null;
	create: (path: string, content: string) => Promise<MockFile>;
	modify: (file: { path: string }, content: string) => Promise<void>;
	append: (file: { path: string }, content: string) => Promise<void>;
	read: (file: { path: string }) => Promise<string>;
	getMarkdownFiles: () => MockFile[];
}

interface MockApp {
	vault: MockVault;
	_files: Map<string, { path: string; content: string }>;
}

/**
 * Creates a mock Obsidian App with an in-memory file system.
 */
const createMockApp = (initialFiles: Record<string, string> = {}): MockApp => {
	const files = new Map<string, { path: string; content: string }>();

	for (const [path, content] of Object.entries(initialFiles)) {
		files.set(path, { path, content });
	}

	const mockVault: MockVault = {
		getAbstractFileByPath: (path: string) => {
			const file = files.get(path);
			if (file) {
				return { path: file.path, extension: "md" };
			}
			return null;
		},
		create: async (path: string, content: string) => {
			files.set(path, { path, content });
			return { path, extension: "md" };
		},
		modify: async (file: { path: string }, content: string) => {
			files.set(file.path, { path: file.path, content });
		},
		append: async (file: { path: string }, content: string) => {
			const existing = files.get(file.path);
			if (existing) {
				files.set(file.path, {
					path: file.path,
					content: existing.content + content,
				});
			}
		},
		read: async (file: { path: string }) => {
			const existing = files.get(file.path);
			return existing?.content ?? "";
		},
		getMarkdownFiles: () => {
			return Array.from(files.values()).map((f) => ({
				path: f.path,
				extension: "md",
			}));
		},
	};

	return {
		vault: mockVault,
		_files: files,
	};
};

const createMockAppLayer = (initialFiles: Record<string, string> = {}) => {
	const mockApp = createMockApp(initialFiles);
	return {
		layer: Layer.succeed(ObsidianApp, mockApp as never),
		mockApp,
	};
};

describe("ObsidianAdapter", () => {
	describe("writeFile", () => {
		it.effect("creates a new file", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;
				yield* adapter.writeFile("test.md", "Hello World");

				const content = yield* adapter.readFile("test.md");
				expect(content).toBe("Hello World");
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(createMockAppLayer().layer),
			),
		);

		it.effect("overwrites existing file", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;
				yield* adapter.writeFile("test.md", "Original");
				yield* adapter.writeFile("test.md", "Updated");

				const content = yield* adapter.readFile("test.md");
				expect(content).toBe("Updated");
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(createMockAppLayer().layer),
			),
		);
	});

	describe("appendToFile", () => {
		it.effect("appends to existing file", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;
				yield* adapter.writeFile("test.md", "Line 1\n");
				yield* adapter.appendToFile("test.md", "Line 2\n");

				const content = yield* adapter.readFile("test.md");
				expect(content).toBe("Line 1\nLine 2\n");
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(createMockAppLayer().layer),
			),
		);

		it.effect("fails when file does not exist", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;
				const result = yield* adapter
					.appendToFile("nonexistent.md", "content")
					.pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ObsidianWriteError);
				}
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(createMockAppLayer().layer),
			),
		);
	});

	describe("readFile", () => {
		it.effect("reads existing file", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;

				const content = yield* adapter.readFile("existing.md");
				expect(content).toBe("Existing content");
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(
					createMockAppLayer({ "existing.md": "Existing content" }).layer,
				),
			),
		);

		it.effect("fails when file does not exist", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;
				const result = yield* adapter
					.readFile("nonexistent.md")
					.pipe(Effect.either);

				expect(result._tag).toBe("Left");
				if (result._tag === "Left") {
					expect(result.left).toBeInstanceOf(ObsidianFileNotFoundError);
				}
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(createMockAppLayer().layer),
			),
		);
	});

	describe("getFile", () => {
		it.effect("returns Some for existing file", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;

				const file = yield* adapter.getFile("existing.md");
				expect(Option.isSome(file)).toBe(true);
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(createMockAppLayer({ "existing.md": "content" }).layer),
			),
		);

		it.effect("returns None for nonexistent file", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;

				const file = yield* adapter.getFile("nonexistent.md");
				expect(Option.isNone(file)).toBe(true);
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(createMockAppLayer().layer),
			),
		);
	});

	describe("listMarkdownFiles", () => {
		it.effect("lists all markdown files", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;

				const files = yield* adapter.listMarkdownFiles;
				expect(files).toHaveLength(2);
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(
					createMockAppLayer({
						"file1.md": "content1",
						"file2.md": "content2",
					}).layer,
				),
			),
		);

		it.effect("returns empty array when no files", () =>
			Effect.gen(function* () {
				const adapter = yield* ObsidianAdapter;

				const files = yield* adapter.listMarkdownFiles;
				expect(files).toHaveLength(0);
			}).pipe(
				Effect.provide(ObsidianAdapter.Default),
				Effect.provide(createMockAppLayer().layer),
			),
		);
	});
});
