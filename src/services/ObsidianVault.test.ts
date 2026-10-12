/**
 * Tests for the vault adapter over an in-memory Obsidian app.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
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
	it.effect("writeFile creates then updates a note", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			const first = yield* withVault(fake.app, (v) =>
				v.writeFile("note.md", "one"),
			);
			const second = yield* withVault(fake.app, (v) =>
				v.writeFile("note.md", "two"),
			);
			assert.strictEqual(first, "created");
			assert.strictEqual(second, "updated");
			assert.strictEqual(fake.read("note.md"), "two");
		}),
	);

	it.effect(
		"writeFile into a missing folder fails with ObsidianWriteError",
		() =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const error = yield* Effect.flip(
					withVault(fake.app, (v) => v.writeFile("missing/note.md", "x")),
				);
				assert.strictEqual(error._tag, "ObsidianWriteError");
				assert.strictEqual(error.path, "missing/note.md");
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

	it.effect(
		"managedNotes finds only plugin notes under the root, recursively",
		() =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				fake.seed("Root/Series/book.md", managed(1));
				fake.seed("Root/Series/mine.md", "# My own note\n");
				fake.seed("Root/Series/data.txt", managed(2));
				fake.seed("Root/Series/Deep/nested.md", managed(3));
				fake.seed("Root/top.md", managed(4));
				fake.seed("Root/plain.md", "---\ntags: x\n---\n");
				fake.seed("Elsewhere/other.md", managed(5));
				const notes = yield* withVault(fake.app, (v) => v.managedNotes("Root"));
				assert.sameMembers(
					[...notes],
					["Root/Series/book.md", "Root/Series/Deep/nested.md", "Root/top.md"],
				);
			}),
	);

	it.effect("managedNotes is empty when the root is missing or a file", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();
			fake.seed("Root", managed(1));
			assert.deepStrictEqual(
				yield* withVault(fake.app, (v) => v.managedNotes("Missing")),
				[],
			);
			assert.deepStrictEqual(
				yield* withVault(fake.app, (v) => v.managedNotes("Root")),
				[],
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
