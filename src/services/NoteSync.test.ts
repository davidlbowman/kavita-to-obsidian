/**
 * Tests for syncing highlights into notes, over an in-memory vault.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Layer, Option, Schema } from "effect";
import { TFile } from "obsidian";
import { type FakeApp, makeFakeApp } from "../../test-support/FakeApp.js";
import { KavitaNetworkError } from "../errors.js";
import { libraryBase } from "../formatters/library.js";
import { SECTION_END, SECTION_START } from "../formatters/note.js";
import {
	buildBookPath,
	buildCoverPath,
	buildLibraryPath,
} from "../formatters/paths.js";
import {
	Annotation,
	DEFAULT_SETTINGS,
	type PluginSettings,
} from "../schemas.js";
import { type CoverImage, KavitaClient } from "./KavitaClient.js";
import { NoteSync } from "./NoteSync.js";
import { ObsidianVault } from "./ObsidianVault.js";
import { PluginConfig } from "./PluginConfig.js";
import { SyncProgress } from "./SyncProgress.js";

const ROOT = DEFAULT_SETTINGS.rootFolderName;

const distinctPositiveInts = (count: number) =>
	Arbitrary.sampleEffect(
		Arbitrary.schema(Schema.Int.check(Schema.isGreaterThan(0))),
		{ count: count * 20 },
	).pipe(
		Effect.map((ints) => [...new Set(ints)]),
		Effect.flatMap((ints) =>
			ints.length >= count
				? Effect.succeed(ints.slice(0, count))
				: Effect.die("not enough distinct ints"),
		),
	);

const at = <A>(values: ReadonlyArray<A>, index: number): A => {
	const value = values[index];
	if (value === undefined) throw new Error(`no value at ${index}`);
	return value;
};

/**
 * Two books in two series: one with two highlights, one with one.
 */
const library = Effect.gen(function* () {
	const ids = yield* distinctPositiveInts(7);
	const sampled = yield* Arbitrary.sampleEffect(Arbitrary.schema(Annotation), {
		count: 4,
	});
	const book = (index: number, chapter: number, series: number) => ({
		...at(sampled, index),
		id: at(ids, index),
		containsSpoiler: false,
		chapterId: at(ids, chapter),
		seriesId: at(ids, series),
		chapterTitle: chapter === 4 ? "Embers" : "Cinders",
		seriesName: series === 6 ? "The Lantern Cycle" : "Ash Tales",
	});
	return {
		ids,
		sampled,
		annotations: [book(0, 4, 6), book(1, 4, 6), book(2, 5, 3)],
		extra: (chapter: "Embers" | "Cinders") =>
			book(3, chapter === "Embers" ? 4 : 5, chapter === "Embers" ? 6 : 3),
	};
});

type Annotations = ReadonlyArray<typeof Annotation.Type>;

/**
 * A stub Kavita that serves `annotations` and records cover requests.
 */
const stubKavita = (
	annotations: () => Annotations,
	cover: (
		chapterId: number,
	) => Effect.Effect<Option.Option<CoverImage>, KavitaNetworkError> = () =>
		Effect.succeedNone,
) => {
	const coverCalls: Array<number> = [];
	const client = KavitaClient.of({
		user: { id: 1 },
		annotations: Effect.sync(annotations),
		volumes: () => Effect.succeed([]),
		cover: (chapterId) => {
			coverCalls.push(chapterId);
			return cover(chapterId);
		},
	});
	return { client, coverCalls };
};

const settings = (overrides: Partial<PluginSettings> = {}): PluginSettings => ({
	...DEFAULT_SETTINGS,
	kavitaUrl: "http://kavita.test",
	kavitaApiKey: "key",
	...overrides,
});

const sync = (
	fake: FakeApp,
	kavita: KavitaClient["Service"],
	overrides: Partial<PluginSettings> = {},
) =>
	Effect.gen(function* () {
		return yield* (yield* NoteSync).sync;
	}).pipe(
		Effect.provide(
			NoteSync.layerNoDeps.pipe(
				Layer.provide(
					Layer.mergeAll(
						Layer.succeed(KavitaClient, kavita),
						ObsidianVault.layer(fake.app),
						PluginConfig.fromSettings(settings(overrides)),
					),
				),
			),
		),
	);

const EMBERS = buildBookPath(ROOT, "The Lantern Cycle", "Embers");
const CINDERS = buildBookPath(ROOT, "Ash Tales", "Cinders");

const edit = (fake: FakeApp, path: string, change: (text: string) => string) =>
	Effect.promise(async () => {
		const file = fake.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error(`no note at ${path}`);
		await fake.app.vault.modify(file, change(fake.read(path) ?? ""));
	});

const trash = (fake: FakeApp, path: string) =>
	Effect.promise(async () => {
		const file = fake.app.vault.getAbstractFileByPath(path);
		if (file === null) throw new Error(`nothing at ${path}`);
		await fake.app.fileManager.trashFile(file);
	});

const managedNote = (chapterId: number) =>
	`---\nkavita_chapter_id: ${chapterId}\nkavita_added: 2000-01-01T00:00:00\nkavita_url: http://kavita.test/library/1/series/1/book/${chapterId}\n---\n\n${SECTION_START}\n\nold\n\n${SECTION_END}\n`;

const legacyNote = (chapterId: number) =>
	`---\nkavita_chapter_id: ${chapterId}\n---\n\n# Old\n`;

describe("NoteSync, one note per book", () => {
	it.effect(
		"files each book under its series with properties and a section",
		() =>
			Effect.gen(function* () {
				const { annotations, ids } = yield* library;
				const fake = makeFakeApp();
				const { client } = stubKavita(() => annotations);
				const summary = yield* sync(fake, client);

				assert.sameMembers([...fake.files().keys()], [EMBERS, CINDERS]);
				const embers = fake.read(EMBERS) ?? "";
				assert.include(embers, `kavita_chapter_id: ${at(ids, 4)}`);
				assert.include(embers, "highlights: 2");
				assert.include(embers, SECTION_START);
				assert.include(embers, SECTION_END);
				assert.include(embers, `^kavita-${at(ids, 0)}`);
				assert.include(embers, `^kavita-${at(ids, 1)}`);
				assert.deepStrictEqual(summary, {
					highlights: 3,
					newHighlights: 3,
					books: 2,
					notesCreated: 2,
					notesUpdated: 0,
					notesUnchanged: 0,
					notesDeleted: 0,
					openPath: EMBERS,
				});
			}),
	);

	it.effect(
		"rewrites nothing when nothing changed, and counts new highlights",
		() =>
			Effect.gen(function* () {
				const { annotations, extra } = yield* library;
				const fake = makeFakeApp();
				let current: Annotations = annotations;
				const { client } = stubKavita(() => current);
				yield* sync(fake, client);
				const before = fake.read(EMBERS);

				const again = yield* sync(fake, client);
				assert.strictEqual(again.notesUnchanged, 2);
				assert.strictEqual(again.notesCreated + again.notesUpdated, 0);
				assert.strictEqual(again.newHighlights, 0);
				assert.strictEqual(fake.read(EMBERS), before);

				current = [...annotations, extra("Embers")];
				const grown = yield* sync(fake, client);
				assert.strictEqual(grown.newHighlights, 1);
				assert.strictEqual(grown.notesUpdated, 1);
				assert.strictEqual(grown.notesUnchanged, 1);
			}),
	);

	it.effect("keeps the user's own text and properties across syncs", () =>
		Effect.gen(function* () {
			const { annotations, extra, ids } = yield* library;
			const fake = makeFakeApp();
			let current: Annotations = annotations;
			const { client } = stubKavita(() => current);
			yield* sync(fake, client);
			yield* edit(
				fake,
				EMBERS,
				(text) =>
					`${text.replace(/^---\n/, "---\nrating: 5\n")}\nMy own thoughts on this book.\n`,
			);

			current = [...annotations, extra("Embers")];
			yield* sync(fake, client);

			const embers = fake.read(EMBERS) ?? "";
			assert.include(embers, "rating: 5");
			assert.include(embers, "My own thoughts on this book.");
			assert.include(embers, `^kavita-${at(ids, 3)}`);
			assert.isAbove(
				embers.indexOf("My own thoughts"),
				embers.indexOf(SECTION_END),
			);
		}),
	);

	it.effect("updates a renamed or moved note in place", () =>
		Effect.gen(function* () {
			const { annotations, extra, ids } = yield* library;
			const fake = makeFakeApp();
			let current: Annotations = annotations;
			const { client } = stubKavita(() => current);
			yield* sync(fake, client);
			const moved = "Reading/My Embers notes.md";
			fake.seed(moved, fake.read(EMBERS) ?? "");
			yield* trash(fake, EMBERS);

			current = [...annotations, extra("Embers")];
			const summary = yield* sync(fake, client);

			assert.strictEqual(summary.notesCreated, 0);
			assert.isUndefined(fake.read(EMBERS));
			assert.include(fake.read(moved) ?? "", `^kavita-${at(ids, 3)}`);
		}),
	);

	it.effect("avoids an unrelated note already at the book's path", () =>
		Effect.gen(function* () {
			const { annotations, ids } = yield* library;
			const fake = makeFakeApp();
			fake.seed(EMBERS, "# Someone else's note\n");
			const { client } = stubKavita(() => annotations);
			yield* sync(fake, client);

			assert.strictEqual(fake.read(EMBERS), "# Someone else's note\n");
			const suffixed = EMBERS.replace(/\.md$/, ` (ch-${at(ids, 4)}).md`);
			assert.include(
				fake.read(suffixed) ?? "",
				`kavita_chapter_id: ${at(ids, 4)}`,
			);
		}),
	);

	it.effect("downloads covers once and links them from the note", () =>
		Effect.gen(function* () {
			const { annotations, ids } = yield* library;
			const fake = makeFakeApp();
			const data = new TextEncoder().encode("png").buffer;
			const { client, coverCalls } = stubKavita(
				() => annotations,
				() => Effect.succeed(Option.some({ data, extension: "jpg" })),
			);
			yield* sync(fake, client);
			const cover = buildCoverPath(ROOT, at(ids, 4), "jpg");

			assert.strictEqual(fake.binaries().get(cover), data);
			assert.include(fake.read(EMBERS) ?? "", `![[${cover}|160]]`);
			assert.include(fake.read(EMBERS) ?? "", `cover: "[[${cover}]]"`);
			assert.strictEqual(coverCalls.length, 2);

			yield* sync(fake, client);
			assert.strictEqual(coverCalls.length, 2);
		}),
	);

	it.effect("skips covers when turned off or when a download fails", () =>
		Effect.gen(function* () {
			const { annotations } = yield* library;
			const off = makeFakeApp();
			const offKavita = stubKavita(() => annotations);
			yield* sync(off, offKavita.client, { downloadCovers: false });
			assert.strictEqual(offKavita.coverCalls.length, 0);

			const failing = makeFakeApp();
			const failingKavita = stubKavita(
				() => annotations,
				() =>
					Effect.fail(
						new KavitaNetworkError({ endpoint: "/api/Image/chapter-cover" }),
					),
			);
			const summary = yield* sync(failing, failingKavita.client);
			assert.strictEqual(summary.notesCreated, 2);
			assert.strictEqual(failing.binaries().size, 0);
			assert.notInclude(failing.read(EMBERS) ?? "", "cover:");
		}),
	);

	it.effect(
		"trashes orphaned notes inside the root and their empty folders",
		() =>
			Effect.gen(function* () {
				const { annotations, ids } = yield* library;
				const fake = makeFakeApp();
				fake.seed(`${ROOT}/Gone/gone.md`, managedNote(at(ids, 0)));
				fake.seed(`${ROOT}/Kept/stale.md`, managedNote(at(ids, 1)));
				fake.seed(`${ROOT}/Kept/mine.md`, "# Mine\n");
				fake.seed(`${ROOT}/mine.md`, "# Also mine\n");
				fake.seed("Elsewhere/old.md", managedNote(at(ids, 2)));
				fake.seed(`${ROOT}/Legacy/old.md`, legacyNote(at(ids, 3)));
				fake.seed(
					`${ROOT}/Other server/book.md`,
					managedNote(at(ids, 5)).replace(
						"http://kavita.test",
						"http://other-kavita.test",
					),
				);
				const { client } = stubKavita(() => annotations);
				const summary = yield* sync(fake, client);

				assert.strictEqual(summary.notesDeleted, 2);
				assert.sameMembers(
					[...fake.trashed()],
					[`${ROOT}/Gone/gone.md`, `${ROOT}/Kept/stale.md`, `${ROOT}/Gone`],
				);
				assert.isDefined(fake.read(`${ROOT}/Kept/mine.md`));
				assert.isDefined(fake.read(`${ROOT}/mine.md`));
				assert.isDefined(fake.read("Elsewhere/old.md"));
				assert.isDefined(fake.read(`${ROOT}/Legacy/old.md`));
				assert.isDefined(fake.read(`${ROOT}/Other server/book.md`));
			}),
	);

	it.effect(
		"never trashes when cleanup is off or Kavita returned nothing",
		() =>
			Effect.gen(function* () {
				const { annotations, ids } = yield* library;
				const orphan = `${ROOT}/Gone/gone.md`;
				const gone = at(ids, 0);

				const off = makeFakeApp();
				off.seed(orphan, managedNote(gone));
				yield* sync(off, stubKavita(() => annotations).client, {
					deleteOrphanedFiles: false,
				});
				assert.deepStrictEqual(off.trashed(), []);

				const empty = makeFakeApp();
				empty.seed(orphan, managedNote(gone));
				const summary = yield* sync(empty, stubKavita(() => []).client);
				assert.deepStrictEqual(empty.trashed(), []);
				assert.strictEqual(summary.books, 0);
				assert.strictEqual(summary.notesDeleted, 0);
				assert.strictEqual(summary.openPath, ROOT);
			}),
	);

	it.effect("creates the library view once and never overwrites it", () =>
		Effect.gen(function* () {
			const { annotations } = yield* library;
			const fake = makeFakeApp();
			const { client } = stubKavita(() => annotations);
			const libraryPath = buildLibraryPath(ROOT);

			const first = yield* sync(fake, client, { createLibraryView: true });
			assert.strictEqual(fake.read(libraryPath), libraryBase(ROOT));
			assert.strictEqual(first.openPath, libraryPath);

			yield* edit(fake, libraryPath, () => "views: []\n");
			yield* sync(fake, client, { createLibraryView: true });
			assert.strictEqual(fake.read(libraryPath), "views: []\n");

			const without = makeFakeApp();
			const summary = yield* sync(without, client);
			assert.isUndefined(without.read(libraryPath));
			assert.strictEqual(summary.openPath, EMBERS);
		}),
	);

	it.effect("reports progress while it works", () =>
		Effect.gen(function* () {
			const { annotations } = yield* library;
			const fake = makeFakeApp();
			const messages: Array<string> = [];
			yield* sync(fake, stubKavita(() => annotations).client).pipe(
				Effect.provide(
					Layer.succeed(SyncProgress, {
						report: (message: string) =>
							Effect.sync(() => {
								messages.push(message);
							}),
					}),
				),
			);
			assert.deepStrictEqual(messages, [
				"Fetching your highlights…",
				"Looking up book details…",
				"Writing 1 of 2: Embers",
				"Writing 2 of 2: Cinders",
			]);
		}),
	);
});

describe("NoteSync, one note for everything", () => {
	it.effect("writes every book into the configured note", () =>
		Effect.gen(function* () {
			const { annotations } = yield* library;
			const fake = makeFakeApp();
			const messages: Array<string> = [];
			const summary = yield* sync(fake, stubKavita(() => annotations).client, {
				exportMode: "single-file",
				outputPath: "Reading/Kavita.md",
			}).pipe(
				Effect.provide(
					Layer.succeed(SyncProgress, {
						report: (message: string) =>
							Effect.sync(() => {
								messages.push(message);
							}),
					}),
				),
			);

			const note = fake.read("Reading/Kavita.md") ?? "";
			assert.include(note, SECTION_START);
			assert.include(note, "### Embers");
			assert.include(note, "### Cinders");
			assert.include(note, "highlights: 3");
			assert.deepStrictEqual([...fake.files().keys()], ["Reading/Kavita.md"]);
			assert.deepStrictEqual(summary, {
				highlights: 3,
				newHighlights: 3,
				books: 2,
				notesCreated: 1,
				notesUpdated: 0,
				notesUnchanged: 0,
				notesDeleted: 0,
				openPath: "Reading/Kavita.md",
			});
			assert.strictEqual(messages.at(-1), "Writing your highlights note…");
		}),
	);

	it.effect("writes to the vault root without creating a folder", () =>
		Effect.gen(function* () {
			const { annotations } = yield* library;
			const fake = makeFakeApp();
			yield* sync(fake, stubKavita(() => annotations).client, {
				exportMode: "single-file",
			});
			assert.isDefined(fake.read(DEFAULT_SETTINGS.outputPath));
			assert.deepStrictEqual(fake.folders(), []);
		}),
	);
});
