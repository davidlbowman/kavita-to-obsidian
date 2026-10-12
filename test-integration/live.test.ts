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
import { Effect, Layer } from "effect";
import {
	capturedNotices,
	clearCapturedNotices,
	requestUrl,
} from "../src/__mocks__/obsidian.js";
import { DEFAULT_SETTINGS, type PluginSettings } from "../src/schemas.js";
import { AnnotationSyncer } from "../src/services/AnnotationSyncer.js";
import { fetchChapterInfo } from "../src/services/ChapterCatalog.js";
import { HierarchicalSyncer } from "../src/services/HierarchicalSyncer.js";
import { KavitaClient } from "../src/services/KavitaClient.js";
import { ObsidianHttpClient } from "../src/services/ObsidianHttpClient.js";
import { PluginConfig } from "../src/services/PluginConfig.js";
import { runSync, syncLayer } from "../src/sync.js";
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

const fixtureAnnotations = Effect.gen(function* () {
	const live = yield* LiveKavita;
	return live.books.flatMap((b) => b.fixture.annotations);
});

const bookTitled = Effect.fnUntraced(function* (title: string) {
	const live = yield* LiveKavita;
	const book = live.books.find((b) => b.fixture.book.title === title);
	if (book === undefined) {
		return yield* Effect.die(`No seeded book "${title}"`);
	}
	return book;
});

const hierarchicalSync = (settings: PluginSettings, fake: FakeApp) =>
	Effect.gen(function* () {
		return yield* (yield* HierarchicalSyncer).sync;
	}).pipe(Effect.provide(syncLayer(settings, fake.app, ObsidianHttpClient)));

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
				const expected = yield* fixtureAnnotations;

				assert.strictEqual(annotations.length, expected.length);
				assert.isTrue(
					annotations.every((a) => a.ownerUserId === live.admin.id),
				);
				assert.sameMembers(
					annotations.map((a) => a.selectedText),
					expected.map((a) => a.selectedText),
				);
				assert.isTrue(requestUrl.mock.calls.length > 0);
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
	});

	describe("hierarchical sync", () => {
		it.effect("writes one note per book with the expected content", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const result = yield* hierarchicalSync(yield* settingsFor(), fake);

				assert.deepStrictEqual(result, {
					annotationCount: 6,
					seriesCount: 2,
					bookCount: 3,
					filesCreated: 3,
					filesUpdated: 0,
					filesDeleted: 0,
				});
				assert.sameMembers(
					[...fake.files().keys()],
					[EMBERS, CINDERS, WHAT_IF],
				);

				const embers = read(fake, EMBERS);
				const embersBook = yield* bookTitled("Embers");
				assert.include(embers, `kavita_chapter_id: ${embersBook.chapterId}`);
				assert.include(embers, "  - author/ada-lumen");
				assert.include(embers, "  - genre/fantasy");
				assert.include(embers, "# Embers");
				assert.include(embers, "**Series:** [[The Lantern Cycle]]");
				assert.include(embers, "**Author:** [[Ada Lumen]]");
				assert.include(
					embers,
					"> Every fire begins as a single spark in the dark.",
				);
				assert.include(embers, "*Note:* Opening line, sets the motif");
				assert.include(embers, "<small>Page 1</small>");
				assert.notInclude(embers, "She learned the keeper's name");
				assert.notInclude(embers, READER_ANNOTATION_TEXT);

				const cinders = read(fake, CINDERS);
				assert.include(cinders, "**Author:** [[Ada Lumen]], [[Bram Coal]]");
				assert.include(
					cinders,
					'> "Fire < Faith > Fear," read the inscription above the hearth.',
				);
				assert.include(cinders, "*Note:* Angle brackets & quotes must survive");
				assert.include(
					cinders,
					"> Café owners along the río kept the embers alive.",
				);

				assert.include(
					read(fake, WHAT_IF),
					"> What would happen if the moon were made of lanterns?",
				);
			}),
		);

		it.effect("includes spoilers when enabled", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				yield* hierarchicalSync(
					yield* settingsFor({ includeSpoilers: true }),
					fake,
				);
				assert.include(
					read(fake, EMBERS),
					"> She learned the keeper's name only at the very end.",
				);
			}),
		);

		it.effect("updates existing notes on re-sync", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const settings = yield* settingsFor();
				yield* hierarchicalSync(settings, fake);
				const second = yield* hierarchicalSync(settings, fake);
				assert.strictEqual(second.filesCreated, 0);
				assert.strictEqual(second.filesUpdated, 3);
				assert.strictEqual(fake.files().size, 3);
			}),
		);

		it.effect(
			"trashes a note once its last annotation is deleted in Kavita",
			() =>
				Effect.gen(function* () {
					const live = yield* LiveKavita;
					const scratch: SeededBook = yield* bookTitled("Scratch Pad");
					const fake = makeFakeApp();
					const userNote = `${ROOT}/My reading notes.md`;
					const settings = yield* settingsFor();

					yield* hierarchicalSync(settings, fake);
					fake.seed(userNote, "# Notes I wrote myself\n");

					const created = yield* Effect.acquireRelease(
						live.api.createAnnotation(
							live.admin,
							live.annotationFor(scratch, "A temporary highlight."),
						),
						(id) =>
							live.api.deleteAnnotation(live.admin, id).pipe(Effect.ignore),
					);

					const withScratch = yield* hierarchicalSync(settings, fake);
					assert.strictEqual(withScratch.filesCreated, 1);
					assert.include(read(fake, SCRATCH), "> A temporary highlight.");

					yield* live.api.deleteAnnotation(live.admin, created);
					const cleaned = yield* hierarchicalSync(settings, fake);

					assert.strictEqual(cleaned.filesDeleted, 1);
					assert.include(fake.trashed(), SCRATCH);
					assert.include(fake.trashed(), `${ROOT}/Scratch Pad`);
					assert.isUndefined(fake.read(SCRATCH));
					assert.strictEqual(fake.read(userNote), "# Notes I wrote myself\n");
					assert.sameMembers(
						[...fake.files().keys()],
						[EMBERS, CINDERS, WHAT_IF, userNote],
					);
				}),
		);
	});

	describe("single-file sync", () => {
		it.effect("writes every annotation into one nested note", () =>
			Effect.gen(function* () {
				const fake = makeFakeApp();
				const settings = yield* settingsFor({
					exportMode: "single-file",
					outputPath: "Reading/Kavita.md",
				});
				const result = yield* Effect.gen(function* () {
					return yield* (yield* AnnotationSyncer).sync;
				}).pipe(
					Effect.provide(syncLayer(settings, fake.app, ObsidianHttpClient)),
				);

				assert.deepStrictEqual(result, {
					annotationCount: 6,
					outputPath: "Reading/Kavita.md",
				});
				const note = read(fake, "Reading/Kavita.md");
				assert.include(note, "## The Lantern Cycle");
				assert.include(note, "### Embers");
				assert.include(note, "### Cinders");
				assert.include(note, "#### Chapter: The Spark");
				assert.isBelow(note.indexOf("### Embers"), note.indexOf("### Cinders"));
				assert.notInclude(note, READER_ANNOTATION_TEXT);
			}),
		);
	});

	describe("plugin sync entry point", () => {
		it.effect("reports a successful sync as a notice", () =>
			Effect.gen(function* () {
				clearCapturedNotices();
				const fake = makeFakeApp();
				yield* runSync(yield* settingsFor(), fake.app, ObsidianHttpClient);
				assert.deepStrictEqual(
					capturedNotices.map((n) => n.message),
					["Synced 6 annotations across 2 series (3 books)"],
				);
			}),
		);

		it.effect("reports a rejected auth key", () =>
			Effect.gen(function* () {
				clearCapturedNotices();
				const fake = makeFakeApp();
				yield* runSync(
					yield* settingsFor({ kavitaApiKey: "not-a-real-key" }),
					fake.app,
					ObsidianHttpClient,
				);
				assert.strictEqual(
					capturedNotices[0]?.message,
					"Kavita rejected your auth key. Check it in the plugin settings.",
				);
				assert.strictEqual(fake.files().size, 0);
			}),
		);

		it.effect("reports an unreachable server", () =>
			Effect.gen(function* () {
				clearCapturedNotices();
				const fake = makeFakeApp();
				yield* runSync(
					yield* settingsFor({ kavitaUrl: "http://127.0.0.1:9" }),
					fake.app,
					ObsidianHttpClient,
				);
				assert.match(
					capturedNotices[0]?.message ?? "",
					/^Cannot reach Kavita: Network error calling \/api\/Plugin\/authenticate/,
				);
			}),
		);
	});
});
