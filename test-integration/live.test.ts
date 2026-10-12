/**
 * End-to-end tests against a real Kavita server.
 *
 * Every test drives the plugin's real services, including the
 * `requestUrl`-based `ObsidianHttpClient` (backed by `fetch` here), into an
 * in-memory vault. Start the server with `bun run integration:up`.
 *
 * @module
 */
import { assert, beforeAll, describe, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { parse } from "yaml";
import { requestUrl } from "../src/__mocks__/obsidian.js";
import { SECTION_END, SECTION_START } from "../src/formatters/note.js";
import { DEFAULT_SETTINGS, type PluginSettings } from "../src/schemas.js";
import { fetchChapterInfo } from "../src/services/ChapterCatalog.js";
import { KavitaClient } from "../src/services/KavitaClient.js";
import { ObsidianHttpClient } from "../src/services/ObsidianHttpClient.js";
import { PluginConfig } from "../src/services/PluginConfig.js";
import { checkConnection, runSync } from "../src/sync.js";
import { describeSyncError } from "../src/ui/errorNotice.js";
import { type FakeApp, makeFakeApp } from "../test-support/FakeApp.js";
import { fetchRequestUrl } from "./support/fetchRequestUrl.js";
import {
	LiveKavita,
	READER_ANNOTATION_TEXT,
	type SeededBook,
} from "./support/LiveKavita.js";

const ROOT = "Kavita Annotations";
const EMBERS = `${ROOT}/The Lantern Cycle/Embers.md`;
const CINDERS = `${ROOT}/The Lantern Cycle/Cinders.md`;
const WHAT_IF = `${ROOT}/What If- Questions- Answered/What If- Questions- Answered.md`;
const SCRATCH = `${ROOT}/Scratch Pad/Scratch Pad.md`;
const LIBRARY = `${ROOT}/Library.base`;
const NOTES = [EMBERS, CINDERS, WHAT_IF];

beforeAll(() => {
	requestUrl.mockImplementation(fetchRequestUrl);
});

const settingsFor = Effect.fnUntraced(function* (
	overrides: Partial<PluginSettings> = {},
) {
	const live = yield* LiveKavita;
	return {
		...DEFAULT_SETTINGS,
		kavitaUrl: live.url,
		kavitaApiKey: live.authKey,
		...overrides,
	};
});

const bookTitled = Effect.fnUntraced(function* (title: string) {
	const live = yield* LiveKavita;
	const book = live.books.find((b) => b.fixture.book.title === title);
	if (book === undefined) {
		return yield* Effect.die(`No seeded book "${title}"`);
	}
	return book;
});

const sync = (settings: PluginSettings, fake: FakeApp) =>
	runSync(settings, fake.app, ObsidianHttpClient);

const liveClient = Effect.gen(function* () {
	const settings = yield* settingsFor();
	return yield* Effect.gen(function* () {
		return yield* KavitaClient;
	}).pipe(
		Effect.provide(
			KavitaClient.layerNoDeps.pipe(
				Layer.provide(PluginConfig.fromSettings(settings)),
				Layer.provide(ObsidianHttpClient),
			),
		),
	);
});

const read = (fake: FakeApp, path: string): string => {
	const content = fake.read(path);
	assert.isDefined(content, `expected ${path} in vault`);
	return content ?? "";
};

const linkedAnnotationIds = (note: string): Array<number> =>
	[...note.matchAll(/\?annotation=(\d+)\)/g)].map((m) => Number(m[1]));

layer(LiveKavita.layer, {
	timeout: "5 minutes",
	excludeTestServices: true,
})("live Kavita", (it) => {
	describe("KavitaClient", () => {
		it.effect("returns only the auth key owner's annotations", () =>
			Effect.gen(function* () {
				const live = yield* LiveKavita;
				const visible = yield* live.api.allVisibleAnnotations(live.admin);
				assert.isTrue(
					visible.some((a) => a.selectedText === READER_ANNOTATION_TEXT),
					"the server shares the reader's annotation with the admin",
				);

				const client = yield* liveClient;
				const annotations = yield* client.annotations;
				const expected = live.books.flatMap((b) => b.fixture.annotations);

				assert.strictEqual(annotations.length, expected.length);
				assert.isTrue(
					annotations.every((a) => a.ownerUserId === live.admin.id),
				);
				assert.sameMembers(
					annotations.map((a) => a.selectedText),
					expected.map((a) => a.selectedText),
				);
				assert.sameMembers(
					annotations.map((a) => a.selectedSlotIndex),
					expected.map((a) => a.slot),
				);
				assert.isTrue(requestUrl.mock.calls.length > 0);
			}),
		);

		it.effect("knows who it is connected as", () =>
			Effect.gen(function* () {
				const client = yield* liveClient;
				assert.strictEqual(client.user.username, "admin");
				assert.match(client.user.kavitaVersion ?? "", /^\d+\.\d+/);
			}),
		);

		it.effect("resolves book titles, authors, and genres from volumes", () =>
			Effect.gen(function* () {
				const live = yield* LiveKavita;
				const client = yield* liveClient;
				const catalog = yield* fetchChapterInfo(
					client,
					live.books.map((b) => b.seriesId),
				);
				for (const book of live.books) {
					const info = catalog.get(book.chapterId);
					assert.isDefined(info);
					assert.strictEqual(info?.bookTitle, book.fixture.book.title);
					assert.sameMembers(
						[...(info?.authors ?? [])],
						[...book.fixture.book.authors],
					);
					assert.sameMembers(
						(info?.genres ?? []).map((g) => g.toLowerCase()),
						book.fixture.book.subjects.map((s) => s.toLowerCase()),
					);
				}
			}),
		);

		it.effect("downloads each book's cover", () =>
			Effect.gen(function* () {
				const live = yield* LiveKavita;
				const client = yield* liveClient;
				for (const book of live.books) {
					const cover = yield* client.cover(book.chapterId);
					assert.isTrue(Option.isSome(cover), book.fixture.book.title);
					if (Option.isSome(cover)) {
						assert.isAbove(cover.value.data.byteLength, 100);
						assert.include(["png", "jpg", "webp"], cover.value.extension);
					}
				}
			}),
		);
	});

	describe("connection check", () => {
		it.effect("reports the user, version, and what will sync", () =>
			Effect.gen(function* () {
				const info = yield* checkConnection(
					yield* settingsFor(),
					ObsidianHttpClient,
				);
				assert.strictEqual(info.username, "admin");
				assert.strictEqual(info.highlights, 6);
				assert.strictEqual(info.books, 3);
			}),
		);

		it.effect("explains a rejected auth key", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					checkConnection(
						yield* settingsFor({ kavitaApiKey: "not-a-real-key" }),
						ObsidianHttpClient,
					),
				);
				assert.strictEqual(error._tag, "KavitaAuthError");
				assert.match(describeSyncError(error).message, /rejected the auth key/);
			}),
		);

		it.effect("explains an unreachable server", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					checkConnection(
						yield* settingsFor({ kavitaUrl: "http://127.0.0.1:9" }),
						ObsidianHttpClient,
					),
				);
				assert.strictEqual(error._tag, "KavitaNetworkError");
				assert.match(describeSyncError(error).message, /Can't reach/);
			}),
		);
	});

	describe("one note per book", () => {
		it.effect("writes rich, linked notes with covers", () =>
			Effect.gen(function* () {
				const live = yield* LiveKavita;
				const fake = makeFakeApp();
				const summary = yield* sync(yield* settingsFor(), fake);

				assert.strictEqual(summary.highlights, 5);
				assert.strictEqual(summary.newHighlights, 5);
				assert.strictEqual(summary.books, 3);
				assert.strictEqual(summary.notesCreated, 3);
				assert.include(NOTES, summary.openPath);
				assert.sameMembers([...fake.files().keys()], NOTES);
				assert.strictEqual(fake.binaries().size, 3);

				const embers = read(fake, EMBERS);
				const book = yield* bookTitled("Embers");
				assert.include(embers, "title: Embers");
				assert.include(embers, '  - "[[Ada Lumen]]"');
				assert.include(embers, 'series: "[[The Lantern Cycle]]"');
				assert.include(embers, "series_index: 1");
				assert.include(
					embers,
					`cover: "[[${ROOT}/Covers/${book.chapterId}.png]]"`,
				);
				assert.include(embers, "highlights: 2");
				assert.include(embers, `kavita_chapter_id: ${book.chapterId}`);
				assert.include(
					embers,
					`kavita_url: ${live.url}/library/${book.libraryId}/series/${book.seriesId}/book/${book.chapterId}`,
				);
				assert.include(embers, SECTION_START);
				assert.include(embers, SECTION_END);
				assert.include(embers, `![[${ROOT}/Covers/${book.chapterId}.png|160]]`);
				assert.include(
					embers,
					"by [[Ada Lumen]] · [[The Lantern Cycle]] #1 · [Open in Kavita]",
				);
				assert.include(embers, "## The Spark");
				assert.include(embers, "> [!kavita-cyan] [Page 1](");
				assert.include(
					embers,
					"> Every fire begins as a single spark in the dark.\n>\n> **Note:** Opening line, sets the motif",
				);
				assert.include(embers, "> [!kavita-yellow] [Page 1](");
				assert.notInclude(embers, "She learned the keeper's name");
				assert.notInclude(embers, READER_ANNOTATION_TEXT);

				const owned = new Set(
					(yield* live.api.allVisibleAnnotations(live.admin))
						.filter((a) => a.ownerUserId === live.admin.id)
						.map((a) => a.id),
				);
				const linked = linkedAnnotationIds(embers);
				assert.lengthOf(linked, 2);
				for (const id of linked) {
					assert.isTrue(owned.has(id), `link to annotation ${id}`);
					assert.include(embers, `\n^kavita-${id}\n`);
				}

				const cinders = read(fake, CINDERS);
				assert.include(cinders, "by [[Ada Lumen]], [[Bram Coal]]");
				assert.include(
					cinders,
					'> "Fire < Faith > Fear," read the inscription above the hearth.',
				);
				assert.include(
					cinders,
					"> Café owners along the río kept the embers alive.",
				);
				assert.include(
					read(fake, WHAT_IF),
					'title: "What If? Questions: Answered"',
				);
			}),
		);

		it.effect("shows spoilers collapsed when enabled", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				yield* sync(yield* settingsFor({ includeSpoilers: true }), fake);
				assert.include(
					read(fake, EMBERS),
					"> [!kavita-magenta]- [Spoiler · Page 2](",
				);
			}),
		);

		it.effect("leaves unchanged notes alone and keeps your edits", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const settings = yield* settingsFor();
				yield* sync(settings, fake);

				const edited = read(fake, EMBERS)
					.replace("---\n", "---\nrating: 5\n")
					.concat("\n## My thoughts\n\nThe lantern imagery is doing a lot.\n");
				fake.move(EMBERS, `${ROOT}/discarded.md`);
				fake.seed(EMBERS, edited);
				fake.move(`${ROOT}/discarded.md`, "Archive/discarded.txt");

				const second = yield* sync(settings, fake);
				assert.strictEqual(second.notesCreated, 0);
				assert.strictEqual(second.newHighlights, 0);
				assert.strictEqual(second.notesUnchanged, 2);
				assert.strictEqual(second.notesUpdated, 1);

				const after = read(fake, EMBERS);
				assert.include(after, "rating: 5");
				assert.include(
					after,
					"## My thoughts\n\nThe lantern imagery is doing a lot.",
				);
				assert.include(after, "> Every fire begins as a single spark");

				const third = yield* sync(settings, fake);
				assert.strictEqual(third.notesUnchanged, 3);
			}),
		);

		it.effect("follows a note that was renamed or moved", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const settings = yield* settingsFor();
				yield* sync(settings, fake);
				fake.move(EMBERS, "Reading/Embers (my copy).md");

				const summary = yield* sync(settings, fake);
				assert.strictEqual(summary.notesCreated, 0);
				assert.isUndefined(fake.read(EMBERS));
				assert.include(
					read(fake, "Reading/Embers (my copy).md"),
					"> Every fire begins as a single spark",
				);
			}),
		);

		it.effect("creates a library view once and never overwrites it", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const settings = yield* settingsFor({ createLibraryView: true });
				const summary = yield* sync(settings, fake);
				assert.strictEqual(summary.openPath, LIBRARY);
				const base: unknown = parse(read(fake, LIBRARY));
				assert.deepNestedInclude(base, {
					"filters.and[0]": `file.inFolder("${ROOT}")`,
				});

				fake.move(LIBRARY, "Archive/original.base");
				fake.seed(LIBRARY, "views: []\n");
				yield* sync(settings, fake);
				assert.strictEqual(read(fake, LIBRARY), "views: []\n");
			}),
		);

		it.effect("trashes a note once its last highlight is deleted", () =>
			Effect.gen(function* () {
				const live = yield* LiveKavita;
				const scratch: SeededBook = yield* bookTitled("Scratch Pad");
				const fake = makeFakeApp();
				const userNote = `${ROOT}/My reading notes.md`;
				const settings = yield* settingsFor();

				yield* sync(settings, fake);
				fake.seed(userNote, "# Notes I wrote myself\n");

				const created = yield* Effect.acquireRelease(
					live.api.createAnnotation(
						live.admin,
						live.annotationFor(scratch, "A temporary highlight."),
					),
					(id) => live.api.deleteAnnotation(live.admin, id).pipe(Effect.ignore),
				);

				const withScratch = yield* sync(settings, fake);
				assert.strictEqual(withScratch.notesCreated, 1);
				assert.strictEqual(withScratch.newHighlights, 1);
				assert.include(read(fake, SCRATCH), "> A temporary highlight.");

				yield* live.api.deleteAnnotation(live.admin, created);
				const cleaned = yield* sync(settings, fake);

				assert.strictEqual(cleaned.notesDeleted, 1);
				assert.include(fake.trashed(), SCRATCH);
				assert.include(fake.trashed(), `${ROOT}/Scratch Pad`);
				assert.strictEqual(fake.read(userNote), "# Notes I wrote myself\n");
				assert.sameMembers([...fake.files().keys()], [...NOTES, userNote]);
			}),
		);
	});

	describe("one note for everything", () => {
		it.effect("collects every highlight in one nested note", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const summary = yield* sync(
					yield* settingsFor({
						exportMode: "single-file",
						outputPath: "Reading/Kavita.md",
					}),
					fake,
				);
				assert.strictEqual(summary.openPath, "Reading/Kavita.md");
				assert.strictEqual(summary.highlights, 5);
				const note = read(fake, "Reading/Kavita.md");
				assert.include(note, "## The Lantern Cycle");
				assert.include(note, "### Embers");
				assert.include(note, "### Cinders");
				assert.include(note, "#### The Spark");
				assert.include(note, "> [!kavita-cyan]");
				assert.isBelow(note.indexOf("### Embers"), note.indexOf("### Cinders"));
				assert.notInclude(note, READER_ANNOTATION_TEXT);
			}),
		);
	});
});
