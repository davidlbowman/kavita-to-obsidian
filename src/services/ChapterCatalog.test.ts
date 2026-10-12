/**
 * Tests for resolving chapter metadata from Kavita volumes.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Schema } from "effect";
import {
	KavitaAuthError,
	type KavitaError,
	KavitaNetworkError,
	KavitaParseError,
} from "../errors.js";
import { Annotation, ChapterInfo, Volume, Volumes } from "../schemas.js";
import { fetchChapterInfo, toBooks, toChapterInfo } from "./ChapterCatalog.js";
import { KavitaClient } from "./KavitaClient.js";

const present = (value: string | null | undefined): value is string =>
	value !== null && value !== undefined && value.trim() !== "";

const sampleVolumes = (count: number) =>
	Arbitrary.sampleEffect(Arbitrary.schema(Volume), { count });

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

const nth = <A>(values: ReadonlyArray<A>, index: number): A => {
	const value = values[index];
	if (value === undefined) throw new Error(`no value at ${index}`);
	return value;
};

const stubKavita = (
	volumes: (
		seriesId: number,
	) => Effect.Effect<ReadonlyArray<Volume>, KavitaError>,
) =>
	KavitaClient.of({
		user: { id: 1 },
		annotations: Effect.succeed([]),
		volumes,
		cover: () => Effect.succeedNone,
	});

describe("toChapterInfo", () => {
	it.prop(
		"skips dot-prefixed metadata markers in genres",
		[Volumes],
		([volumes]) => {
			const marked = volumes.map((volume) => ({
				...volume,
				chapters: volume.chapters.map((chapter) => ({
					...chapter,
					genres: [{ title: ".verified" }, { title: "War" }],
				})),
			}));
			for (const info of toChapterInfo(marked)) {
				assert.deepStrictEqual(info.genres, ["War"]);
			}
		},
	);

	it.prop(
		"describes every chapter with the title fallback chain",
		[Volumes],
		([volumes]) => {
			const infos = toChapterInfo(volumes);
			const chapters = volumes.flatMap((volume) =>
				volume.chapters.map((chapter) => ({ volume, chapter })),
			);
			assert.strictEqual(infos.length, chapters.length);
			chapters.forEach(({ volume, chapter }, i) => {
				const info = infos[i];
				assert.isDefined(info);
				assert.strictEqual(info?.chapterId, chapter.id);
				assert.strictEqual(info?.sortOrder, volume.number);
				const expectedTitle = present(chapter.titleName)
					? chapter.titleName
					: present(volume.name)
						? volume.name
						: `Volume ${volume.number}`;
				assert.strictEqual(info?.bookTitle, expectedTitle);
				assert.deepStrictEqual(
					info?.authors,
					(chapter.writers ?? []).map((w) => w.name).filter(present),
				);
				assert.deepStrictEqual(
					info?.genres,
					(chapter.genres ?? [])
						.map((g) => g.title)
						.filter(present)
						.filter((genre) => !genre.startsWith(".")),
				);
				assert.isFalse(info?.authors.some((a) => a.trim() === ""));
			});
		},
	);

	it.effect("skips blank titles and names down to the volume number", () =>
		Effect.gen(function* () {
			const volume = nth(yield* sampleVolumes(1), 0);
			const [info] = toChapterInfo([
				{
					...volume,
					name: "  ",
					chapters: [
						{
							id: volume.id,
							titleName: "",
							writers: [{ name: null }, { name: " " }],
							genres: [{ title: null }],
						},
					],
				},
			]);
			assert.strictEqual(info?.bookTitle, `Volume ${volume.number}`);
			assert.deepStrictEqual(info?.authors, []);
			assert.deepStrictEqual(info?.genres, []);
		}),
	);
});

describe("fetchChapterInfo", () => {
	it.effect("merges chapters from every series and dedupes series ids", () =>
		Effect.gen(function* () {
			const ids = yield* distinctPositiveInts(2);
			const [first, second] = [nth(ids, 0), nth(ids, 1)];
			const volumes = yield* sampleVolumes(2);
			const [a, b] = [nth(volumes, 0), nth(volumes, 1)];
			const bySeries = new Map([
				[first, [a]],
				[second, [b]],
			]);
			const calls: Array<number> = [];
			const kavita = stubKavita((seriesId) => {
				calls.push(seriesId);
				return Effect.succeed(bySeries.get(seriesId) ?? []);
			});

			const catalog = yield* fetchChapterInfo(kavita, [first, second, first]);

			assert.sameMembers(calls, [first, second]);
			for (const info of toChapterInfo([a, b])) {
				assert.isTrue(catalog.has(info.chapterId));
			}
		}),
	);

	it.effect(
		"skips series whose volumes fail with network or parse errors",
		() =>
			Effect.gen(function* () {
				const ids = yield* distinctPositiveInts(3);
				const [ok, network, parse] = [nth(ids, 0), nth(ids, 1), nth(ids, 2)];
				const volume = nth(yield* sampleVolumes(1), 0);
				const kavita = stubKavita((seriesId) =>
					seriesId === network
						? Effect.fail(
								new KavitaNetworkError({ endpoint: "/v", statusCode: 500 }),
							)
						: seriesId === parse
							? Effect.fail(
									new KavitaParseError({
										endpoint: "/v",
										cause: new Error("bad"),
									}),
								)
							: Effect.succeed(seriesId === ok ? [volume] : []),
				);

				const catalog = yield* fetchChapterInfo(kavita, [ok, network, parse]);

				assert.deepStrictEqual(
					[...catalog.values()],
					[
						...new Map(
							toChapterInfo([volume]).map((i) => [i.chapterId, i]),
						).values(),
					],
				);
			}),
	);

	it.effect("propagates auth failures", () =>
		Effect.gen(function* () {
			const seriesId = nth(yield* distinctPositiveInts(1), 0);
			const kavita = stubKavita(() =>
				Effect.fail(
					new KavitaAuthError({
						endpoint: "/api/Series/volumes",
						statusCode: 401,
					}),
				),
			);
			const error = yield* Effect.flip(fetchChapterInfo(kavita, [seriesId]));
			assert.strictEqual(error._tag, "KavitaAuthError");
		}),
	);
});

describe("toBooks", () => {
	it.effect("makes one book per chapter, using catalog metadata", () =>
		Effect.gen(function* () {
			const [first, second, third] = yield* distinctPositiveInts(3);
			const sampled = yield* Arbitrary.sampleEffect(
				Arbitrary.schema(Annotation),
				{ count: 3 },
			);
			const info = nth(
				yield* Arbitrary.sampleEffect(Arbitrary.schema(ChapterInfo), {
					count: 1,
				}),
				0,
			);
			const chapterA = first ?? 1;
			const chapterB = second ?? 2;
			const annotations = [
				{ ...nth(sampled, 0), chapterId: chapterA, id: third ?? 3 },
				{ ...nth(sampled, 1), chapterId: chapterB },
				{ ...nth(sampled, 2), chapterId: chapterA },
			];
			const books = toBooks(
				annotations,
				new Map([[chapterA, { ...info, chapterId: chapterA }]]),
			);

			assert.strictEqual(books.length, 2);
			const withInfo = books.find((b) => b.chapterId === chapterA);
			const without = books.find((b) => b.chapterId === chapterB);
			assert.deepStrictEqual(withInfo?.annotations, [
				nth(annotations, 0),
				nth(annotations, 2),
			]);
			assert.strictEqual(withInfo?.bookTitle, info.bookTitle);
			assert.strictEqual(withInfo?.seriesIndex, info.sortOrder);
			assert.deepStrictEqual(withInfo?.authors, info.authors);
			assert.deepStrictEqual(withInfo?.genres, info.genres);
			assert.strictEqual(withInfo?.libraryId, annotations[0]?.libraryId);
			assert.strictEqual(withInfo?.seriesId, annotations[0]?.seriesId);
			assert.strictEqual(without?.seriesIndex, 1);
			assert.deepStrictEqual(without?.authors, []);
			assert.deepStrictEqual(without?.genres, []);
		}),
	);

	it.effect("falls back to the chapter title, then the chapter id", () =>
		Effect.gen(function* () {
			const [titled, untitled] = yield* distinctPositiveInts(2);
			const sampled = yield* Arbitrary.sampleEffect(
				Arbitrary.schema(Annotation),
				{ count: 2 },
			);
			const books = toBooks(
				[
					{
						...nth(sampled, 0),
						chapterId: titled ?? 1,
						chapterTitle: "Chapter title",
						seriesName: null,
					},
					{
						...nth(sampled, 1),
						chapterId: untitled ?? 2,
						chapterTitle: null,
					},
				],
				new Map(),
			);
			const first = books.find((b) => b.chapterId === titled);
			const second = books.find((b) => b.chapterId === untitled);
			assert.strictEqual(first?.bookTitle, "Chapter title");
			assert.strictEqual(first?.seriesName, `Series ${first?.seriesId}`);
			assert.strictEqual(second?.bookTitle, `Chapter ${untitled}`);
		}),
	);

	it("returns nothing for no highlights", () => {
		assert.deepStrictEqual(toBooks([], new Map()), []);
	});
});
