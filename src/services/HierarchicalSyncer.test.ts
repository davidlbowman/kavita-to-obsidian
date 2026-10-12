/**
 * Tests for the hierarchical syncer over an in-memory vault.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Layer, Schema } from "effect";
import { type FakeApp, makeFakeApp } from "../../test-support/FakeApp.js";
import { formatBookFile } from "../formatters/bookFile.js";
import { buildBookPath } from "../formatters/paths.js";
import {
	Annotation,
	ChapterInfo,
	DEFAULT_SETTINGS,
	type PluginSettings,
	Volume,
} from "../schemas.js";
import { HierarchicalSyncer, toBookFiles } from "./HierarchicalSyncer.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianVault } from "./ObsidianVault.js";
import { PluginConfig } from "./PluginConfig.js";

const EPOCH = "1970-01-01T00:00:00.000Z";
const ROOT = DEFAULT_SETTINGS.rootFolderName;

const Name = Schema.String.check(Schema.isPattern(/^[A-Z][a-z]{2,10}$/));

const nth = <A>(values: ReadonlyArray<A>, index: number): A => {
	const value = values[index];
	if (value === undefined) throw new Error(`no value at ${index}`);
	return value;
};

const distinct = <S extends Schema.Top>(schema: S, count: number) =>
	Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: count * 20 }).pipe(
		Effect.map((values) => [...new Set(values)]),
		Effect.flatMap((values) =>
			values.length >= count
				? Effect.succeed(values.slice(0, count))
				: Effect.die("not enough distinct samples"),
		),
	);

const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0));

/**
 * A library shape: series name → book title per chapter, in chapter order.
 */
interface Book {
	readonly seriesId: number;
	readonly seriesName: string;
	readonly chapterId: number;
	readonly bookTitle: string;
}

/**
 * Sample `seriesCount` series with `booksPerSeries` books each, distinct ids
 * ascending within a series and distinct names.
 */
const sampleBooks = (seriesCount: number, booksPerSeries: number) =>
	Effect.gen(function* () {
		const total = seriesCount * booksPerSeries;
		const ids = yield* distinct(PositiveInt, seriesCount + total);
		const names = yield* distinct(Name, seriesCount + total);
		const chapterIds = ids.slice(seriesCount).sort((a, b) => a - b);
		const books: Array<Book> = [];
		for (let s = 0; s < seriesCount; s++) {
			for (let b = 0; b < booksPerSeries; b++) {
				const i = s * booksPerSeries + b;
				books.push({
					seriesId: nth(ids, s),
					seriesName: nth(names, s),
					chapterId: nth(chapterIds, i),
					bookTitle: nth(names, seriesCount + i),
				});
			}
		}
		return books;
	});

/**
 * Two sampled annotations per book, all wired to the book's ids and names.
 */
const annotationsFor = (books: ReadonlyArray<Book>) =>
	Effect.gen(function* () {
		const sampled = yield* Arbitrary.sampleEffect(
			Arbitrary.schema(Annotation),
			{
				count: books.length * 2,
			},
		);
		return sampled.map((annotation, i) => {
			const book = nth(books, Math.floor(i / 2));
			return {
				...annotation,
				seriesId: book.seriesId,
				seriesName: book.seriesName,
				chapterId: book.chapterId,
			};
		});
	});

const kavitaFor = (
	books: ReadonlyArray<Book>,
	annotations: ReadonlyArray<Annotation>,
) =>
	Effect.gen(function* () {
		const template = nth(
			yield* Arbitrary.sampleEffect(Arbitrary.schema(Volume), { count: 1 }),
			0,
		);
		return KavitaClient.of({
			annotations: Effect.succeed(annotations),
			volumes: (seriesId) =>
				Effect.succeed([
					{
						...template,
						chapters: books
							.filter((b) => b.seriesId === seriesId)
							.map((b) => ({ id: b.chapterId, titleName: b.bookTitle })),
					},
				]),
		});
	});

const syncerLayer = (
	kavita: KavitaClient["Service"],
	fake: FakeApp,
	overrides: Partial<PluginSettings> = {},
) =>
	HierarchicalSyncer.layerNoDeps.pipe(
		Layer.provide(
			Layer.mergeAll(
				Layer.succeed(KavitaClient, kavita),
				ObsidianVault.layer(fake.app),
			),
		),
		Layer.provideMerge(
			PluginConfig.fromSettings({
				...DEFAULT_SETTINGS,
				kavitaUrl: "http://kavita.test",
				kavitaApiKey: "key",
				...overrides,
			}),
		),
	);

const runSync = Effect.gen(function* () {
	return yield* (yield* HierarchicalSyncer).sync;
});

const managed = (chapterId: number) =>
	`---\nkavita_chapter_id: ${chapterId}\n---\n`;

describe("HierarchicalSyncer", () => {
	it.effect("writes Root/Series/Book.md for every book", () =>
		Effect.gen(function* () {
			const books = yield* sampleBooks(2, 2);
			const annotations = yield* annotationsFor(books);
			const kavita = yield* kavitaFor(books, annotations);
			const fake = makeFakeApp();

			const { result, config } = yield* Effect.gen(function* () {
				return { result: yield* runSync, config: yield* PluginConfig };
			}).pipe(Effect.provide(syncerLayer(kavita, fake)));

			assert.deepStrictEqual(result, {
				annotationCount: annotations.length,
				seriesCount: 2,
				bookCount: 4,
				filesCreated: 4,
				filesUpdated: 0,
				filesDeleted: 0,
			});
			for (const book of books) {
				const path = `${ROOT}/${book.seriesName}/${book.bookTitle}.md`;
				const expected = formatBookFile(
					{
						bookTitle: book.bookTitle,
						seriesName: book.seriesName,
						seriesId: book.seriesId,
						chapterId: book.chapterId,
						authors: [],
						genres: [],
						annotations: annotations.filter(
							(a) => a.chapterId === book.chapterId,
						),
					},
					config,
					EPOCH,
				);
				assert.strictEqual(fake.read(path), expected);
			}
			assert.sameMembers(
				[...fake.folders()],
				[ROOT, ...new Set(books.map((b) => `${ROOT}/${b.seriesName}`))],
			);
		}),
	);

	it.effect("disambiguates duplicate book titles with the chapter id", () =>
		Effect.gen(function* () {
			const sampled = yield* sampleBooks(1, 2);
			const first = nth(sampled, 0);
			const second = nth(sampled, 1);
			const books = [first, { ...second, bookTitle: first.bookTitle }];
			const annotations = yield* annotationsFor(books);
			const kavita = yield* kavitaFor(books, annotations);
			const fake = makeFakeApp();

			yield* runSync.pipe(Effect.provide(syncerLayer(kavita, fake)));

			const base = buildBookPath(ROOT, first.seriesName, first.bookTitle);
			assert.sameMembers(
				[...fake.files().keys()],
				[base, base.replace(/\.md$/, ` (ch-${second.chapterId}).md`)],
			);
		}),
	);

	it.effect("counts created and updated notes across syncs", () =>
		Effect.gen(function* () {
			const books = yield* sampleBooks(1, 3);
			const annotations = yield* annotationsFor(books);
			const kavita = yield* kavitaFor(books, annotations);
			const fake = makeFakeApp();
			const layer = syncerLayer(kavita, fake);

			const first = yield* runSync.pipe(Effect.provide(layer));
			const second = yield* runSync.pipe(Effect.provide(layer));

			assert.strictEqual(first.filesCreated, 3);
			assert.strictEqual(first.filesUpdated, 0);
			assert.strictEqual(second.filesCreated, 0);
			assert.strictEqual(second.filesUpdated, 3);
		}),
	);

	const seedOrphans = (fake: FakeApp, current: Book) => {
		fake.seed(`${ROOT}/Gone/gone.md`, managed(1));
		fake.seed(`${ROOT}/Kept/stale.md`, managed(2));
		fake.seed(`${ROOT}/Kept/mine.md`, "# My own notes\n");
		fake.seed(`${ROOT}/loose.md`, managed(3));
		fake.seed(
			buildBookPath(ROOT, current.seriesName, current.bookTitle),
			managed(current.chapterId),
		);
	};

	it.effect("trashes managed notes whose annotations are gone", () =>
		Effect.gen(function* () {
			const books = yield* sampleBooks(1, 1);
			const book = nth(books, 0);
			const annotations = yield* annotationsFor(books);
			const kavita = yield* kavitaFor(books, annotations);
			const fake = makeFakeApp();
			seedOrphans(fake, book);

			const result = yield* runSync.pipe(
				Effect.provide(syncerLayer(kavita, fake)),
			);

			assert.strictEqual(result.filesDeleted, 3);
			assert.strictEqual(result.filesUpdated, 1);
			assert.sameMembers(
				[...fake.trashed()],
				[
					`${ROOT}/Gone/gone.md`,
					`${ROOT}/Kept/stale.md`,
					`${ROOT}/loose.md`,
					`${ROOT}/Gone`,
				],
			);
			assert.isDefined(fake.read(`${ROOT}/Kept/mine.md`));
			assert.include([...fake.folders()], ROOT);
			assert.include([...fake.folders()], `${ROOT}/Kept`);
		}),
	);

	it.effect("keeps orphans when deleteOrphanedFiles is off", () =>
		Effect.gen(function* () {
			const books = yield* sampleBooks(1, 1);
			const annotations = yield* annotationsFor(books);
			const kavita = yield* kavitaFor(books, annotations);
			const fake = makeFakeApp();
			seedOrphans(fake, nth(books, 0));

			const result = yield* runSync.pipe(
				Effect.provide(
					syncerLayer(kavita, fake, { deleteOrphanedFiles: false }),
				),
			);

			assert.strictEqual(result.filesDeleted, 0);
			assert.deepStrictEqual(fake.trashed(), []);
		}),
	);

	it.effect("never trashes anything when Kavita returns no annotations", () =>
		Effect.gen(function* () {
			const books = yield* sampleBooks(1, 1);
			const kavita = yield* kavitaFor(books, []);
			const fake = makeFakeApp();
			seedOrphans(fake, nth(books, 0));

			const result = yield* runSync.pipe(
				Effect.provide(syncerLayer(kavita, fake)),
			);

			assert.deepStrictEqual(result, {
				annotationCount: 0,
				seriesCount: 0,
				bookCount: 0,
				filesCreated: 0,
				filesUpdated: 0,
				filesDeleted: 0,
			});
			assert.deepStrictEqual(fake.trashed(), []);
		}),
	);
});

describe("toBookFiles", () => {
	it.effect(
		"falls back to annotation titles and ids without chapter info",
		() =>
			Effect.gen(function* () {
				const sampled = yield* Arbitrary.sampleEffect(
					Arbitrary.schema(Annotation),
					{
						count: 2,
					},
				);
				const ids = yield* distinct(PositiveInt, 3);
				const titled = {
					...nth(sampled, 0),
					seriesId: nth(ids, 0),
					chapterId: nth(ids, 1),
					seriesName: null,
					chapterTitle: "From TOC",
				};
				const untitled = {
					...nth(sampled, 1),
					seriesId: nth(ids, 0),
					chapterId: nth(ids, 2),
					seriesName: null,
					chapterTitle: null,
				};

				const [series] = toBookFiles([titled, untitled], new Map());

				assert.strictEqual(series?.length, 2);
				const byChapter = new Map((series ?? []).map((b) => [b.chapterId, b]));
				assert.strictEqual(
					byChapter.get(titled.chapterId)?.bookTitle,
					"From TOC",
				);
				assert.strictEqual(
					byChapter.get(untitled.chapterId)?.bookTitle,
					`Chapter ${untitled.chapterId}`,
				);
				assert.strictEqual(
					byChapter.get(titled.chapterId)?.seriesName,
					`Series ${titled.seriesId}`,
				);
				assert.deepStrictEqual(byChapter.get(titled.chapterId)?.authors, []);
			}),
	);

	it.effect("uses chapter info for titles, authors, and genres", () =>
		Effect.gen(function* () {
			const annotation = nth(
				yield* Arbitrary.sampleEffect(Arbitrary.schema(Annotation), {
					count: 1,
				}),
				0,
			);
			const info = nth(
				yield* Arbitrary.sampleEffect(Arbitrary.schema(ChapterInfo), {
					count: 1,
				}),
				0,
			);
			const linked = { ...info, chapterId: annotation.chapterId };

			const book = nth(
				nth(
					toBookFiles([annotation], new Map([[linked.chapterId, linked]])),
					0,
				),
				0,
			);

			assert.strictEqual(book?.bookTitle, linked.bookTitle);
			assert.deepStrictEqual(book?.authors, linked.authors);
			assert.deepStrictEqual(book?.genres, linked.genres);
			assert.deepStrictEqual(book?.annotations, [annotation]);
		}),
	);
});
