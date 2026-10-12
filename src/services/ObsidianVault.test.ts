/**
 * Tests for the vault adapter over an in-memory Obsidian app.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { type FakeApp, makeFakeApp } from "../../test-support/FakeApp.js";
import type { ObsidianApp } from "./ObsidianApp.js";
import { ObsidianVault } from "./ObsidianVault.js";

const withVault = <A, E>(
	app: ObsidianApp["Service"],
	f: (vault: ObsidianVault["Service"]) => Effect.Effect<A, E>,
) =>
	Effect.gen(function* () {
		return yield* f(yield* ObsidianVault);
	}).pipe(Effect.provide(ObsidianVault.layer(app)));

const managed = (chapterId: number) =>
	`---\nkavita_chapter_id: ${chapterId}\n---\n\n# Book\n`;

const failingTrash = (fake: FakeApp): ObsidianApp["Service"] => ({
	...fake.app,
	fileManager: {
		trashFile: () => Promise.reject(new Error("trash failed")),
	},
});

describe("ObsidianVault", () => {
	it.effect("writeText creates, updates, and skips unchanged notes", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			const outcomes = yield* withVault(fake.app, (v) =>
				Effect.all([
					v.writeText("note.md", "one"),
					v.writeText("note.md", "two"),
					v.writeText("note.md", "two"),
				]),
			);
			assert.deepStrictEqual(outcomes, ["created", "updated", "unchanged"]);
			assert.strictEqual(fake.read("note.md"), "two");
		}),
	);

	it.effect(
		"writeText into a missing folder fails with ObsidianWriteError",
		() =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const error = yield* Effect.flip(
					withVault(fake.app, (v) => v.writeText("missing/note.md", "x")),
				);
				assert.strictEqual(error._tag, "ObsidianWriteError");
				assert.strictEqual(error.path, "missing/note.md");
			}),
	);

	it.effect("readText reads notes and is None for missing paths", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			fake.seed("Root/a.md", "hello");
			const [found, missing, folder] = yield* withVault(fake.app, (v) =>
				Effect.all([
					v.readText("Root/a.md"),
					v.readText("Root/b.md"),
					v.readText("Root"),
				]),
			);
			assert.deepStrictEqual(found, Option.some("hello"));
			assert.isTrue(Option.isNone(missing));
			assert.isTrue(Option.isNone(folder));
		}),
	);

	it.effect("writeBinaryIfMissing writes once and never overwrites", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			const first = new TextEncoder().encode("first").buffer;
			const second = new TextEncoder().encode("second").buffer;
			const outcomes = yield* withVault(fake.app, (v) =>
				Effect.all([
					v.writeBinaryIfMissing("cover.png", first),
					v.writeBinaryIfMissing("cover.png", second),
				]),
			);
			assert.deepStrictEqual(outcomes, ["created", "unchanged"]);
			assert.strictEqual(fake.binaries().get("cover.png"), first);
		}),
	);

	it.effect("writeBinaryIfMissing failures become ObsidianWriteError", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			const error = yield* Effect.flip(
				withVault(fake.app, (v) =>
					v.writeBinaryIfMissing("missing/cover.png", new ArrayBuffer(1)),
				),
			);
			assert.strictEqual(error._tag, "ObsidianWriteError");
		}),
	);

	it.effect("exists sees files and folders", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			fake.seed("Root/a.md", "a");
			const [file, folder, missing] = yield* withVault(fake.app, (v) =>
				Effect.all([v.exists("Root/a.md"), v.exists("Root"), v.exists("nope")]),
			);
			assert.deepStrictEqual([file, folder, missing], [true, true, false]);
		}),
	);

	it.effect("ensureFolder creates nested folders and is idempotent", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			yield* withVault(fake.app, (v) => v.ensureFolder("a/b/c"));
			yield* withVault(fake.app, (v) => v.ensureFolder("a/b/c"));
			yield* withVault(fake.app, (v) => v.ensureFolder("a/b"));
			assert.sameMembers([...fake.folders()], ["a", "a/b", "a/b/c"]);
		}),
	);

	it.effect(
		"ensureFolder over an existing file fails with ObsidianFolderError",
		() =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				fake.seed("taken", "file");
				const error = yield* Effect.flip(
					withVault(fake.app, (v) => v.ensureFolder("taken")),
				);
				assert.strictEqual(error._tag, "ObsidianFolderError");
				assert.strictEqual(error.operation, "create");
			}),
	);

	it.effect("bookNotes finds every book note in the vault by chapter id", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			fake.seed("Root/Series/book.md", managed(1));
			fake.seed("Root/Series/mine.md", "# My own note\n");
			fake.seed("Root/Series/Deep/nested.md", managed(3));
			fake.seed("Root/quoted.md", '---\nkavita_chapter_id: "4"\n---\n');
			fake.seed("Root/bad.md", "---\nkavita_chapter_id: soon\n---\n");
			fake.seed("Root/plain.md", "---\ntags: x\n---\n");
			fake.seed("Moved/elsewhere.md", managed(5));
			fake.seed("Root/data.txt", managed(2));
			fake.seed(
				"Root/full.md",
				"---\ntitle: Embers\nkavita_chapter_id: 6\nkavita_added: 2026-01-02T03:04:05\nkavita_url: http://kavita.test/library/1/series/1/book/6\n---\n",
			);
			const notes = yield* withVault(fake.app, (v) => v.bookNotes);
			assert.sameDeepMembers(
				[...notes],
				[
					...[
						{ path: "Root/Series/book.md", chapterId: 1 },
						{ path: "Root/Series/Deep/nested.md", chapterId: 3 },
						{ path: "Root/quoted.md", chapterId: 4 },
						{ path: "Moved/elsewhere.md", chapterId: 5 },
					].map((ref) => ({
						...ref,
						added: undefined,
						title: undefined,
						url: undefined,
					})),
					{
						path: "Root/full.md",
						chapterId: 6,
						added: "2026-01-02T03:04:05",
						title: "Embers",
						url: "http://kavita.test/library/1/series/1/book/6",
					},
				],
			);
		}),
	);

	it.effect("trashFile trashes notes and ignores missing paths", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			fake.seed("Root/a.md", "a");
			yield* withVault(fake.app, (v) => v.trashFile("Root/a.md"));
			yield* withVault(fake.app, (v) => v.trashFile("Root/missing.md"));
			yield* withVault(fake.app, (v) => v.trashFile("Root"));
			assert.deepStrictEqual(fake.trashed(), ["Root/a.md"]);
			assert.isUndefined(fake.read("Root/a.md"));
		}),
	);

	it.effect("trashFile failures become ObsidianWriteError", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			fake.seed("a.md", "a");
			const error = yield* Effect.flip(
				withVault(failingTrash(fake), (v) => v.trashFile("a.md")),
			);
			assert.strictEqual(error._tag, "ObsidianWriteError");
		}),
	);

	it.effect("trashFolderIfEmpty only trashes empty folders", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			fake.seed("Root/Full/a.md", "a");
			yield* withVault(fake.app, (v) => v.ensureFolder("Root/Empty"));
			yield* withVault(fake.app, (v) => v.trashFolderIfEmpty("Root/Empty"));
			yield* withVault(fake.app, (v) => v.trashFolderIfEmpty("Root/Full"));
			yield* withVault(fake.app, (v) => v.trashFolderIfEmpty("Root/Missing"));
			yield* withVault(fake.app, (v) => v.trashFolderIfEmpty("Root/Full/a.md"));
			assert.deepStrictEqual(fake.trashed(), ["Root/Empty"]);
			assert.sameMembers([...fake.folders()], ["Root", "Root/Full"]);
		}),
	);

	it.effect("trashFolderIfEmpty failures become ObsidianFolderError", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			yield* withVault(fake.app, (v) => v.ensureFolder("Empty"));
			const error = yield* Effect.flip(
				withVault(failingTrash(fake), (v) => v.trashFolderIfEmpty("Empty")),
			);
			assert.strictEqual(error._tag, "ObsidianFolderError");
			assert.strictEqual(error.operation, "delete");
		}),
	);
});
