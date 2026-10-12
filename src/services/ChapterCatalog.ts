/**
 * Resolve book titles, authors, and genres for annotated chapters.
 *
 * @module
 */
import { Effect } from "effect";
import type { Annotation, Book, ChapterInfo, Volume } from "../schemas.js";
import type { KavitaClient } from "./KavitaClient.js";

const nonEmpty = (value: string | null | undefined): string | undefined =>
	value === null || value === undefined || value.trim() === ""
		? undefined
		: value;

const names = (
	values: ReadonlyArray<string | null> | undefined,
): Array<string> =>
	(values ?? []).flatMap((value) => {
		const name = nonEmpty(value);
		return name === undefined ? [] : [name];
	});

/**
 * Chapter ID to book-level metadata.
 *
 * @since 0.0.2
 * @category Chapter Catalog
 */
export type ChapterInfoMap = ReadonlyMap<number, ChapterInfo>;

/**
 * Flatten a series' volumes into per-chapter book metadata.
 *
 * Genres starting with "." are markers metadata providers add (such as
 * ".verified"), not real genres, so they are skipped.
 *
 * @since 2.0.0
 * @category Chapter Catalog
 */
export const toChapterInfo = (
	volumes: ReadonlyArray<Volume>,
): Array<ChapterInfo> =>
	volumes.flatMap((volume) =>
		volume.chapters.map((chapter): ChapterInfo => ({
			chapterId: chapter.id,
			added: chapter.createdUtc ?? "",
			bookTitle:
				nonEmpty(chapter.titleName) ??
				nonEmpty(volume.name) ??
				`Volume ${volume.number}`,
			sortOrder: volume.number,
			authors: names(chapter.writers?.map((w) => w.name)),
			genres: names(chapter.genres?.map((g) => g.title)).filter(
				(genre) => !genre.startsWith("."),
			),
		})),
	);

/**
 * Fetch chapter metadata for every series, tolerating per-series failures.
 *
 * A series whose volumes cannot be loaded is logged and falls back to titles
 * from the annotations themselves; an auth failure still aborts the sync.
 *
 * @since 2.0.0
 * @category Chapter Catalog
 */
export const fetchChapterInfo = Effect.fn("ChapterCatalog.fetchChapterInfo")(
	function* (kavita: KavitaClient["Service"], seriesIds: Iterable<number>) {
		const perSeries = yield* Effect.forEach(
			new Set(seriesIds),
			(seriesId) =>
				kavita.volumes(seriesId).pipe(
					Effect.map(toChapterInfo),
					Effect.catchTag(["KavitaNetworkError", "KavitaParseError"], (error) =>
						Effect.logWarning(
							`Skipping metadata for series ${seriesId}`,
							error,
						).pipe(Effect.as([])),
					),
				),
			{ concurrency: 4 },
		);
		const catalog: ChapterInfoMap = new Map(
			perSeries.flat().map((info) => [info.chapterId, info]),
		);
		return catalog;
	},
);

/**
 * Group highlights into one {@link Book} per chapter, using catalog metadata
 * where Kavita provided it.
 *
 * @since 2.0.0
 * @category Chapter Catalog
 */
export const toBooks = (
	annotations: ReadonlyArray<Annotation>,
	catalog: ChapterInfoMap,
): Array<Book> => {
	const byChapter = new Map<number, Array<Annotation>>();
	for (const annotation of annotations) {
		const group = byChapter.get(annotation.chapterId);
		if (group === undefined) byChapter.set(annotation.chapterId, [annotation]);
		else group.push(annotation);
	}
	return [...byChapter.values()].flatMap((group): Array<Book> => {
		const first = group[0];
		if (first === undefined) return [];
		const info = catalog.get(first.chapterId);
		return [
			{
				bookTitle:
					info?.bookTitle ?? first.chapterTitle ?? `Chapter ${first.chapterId}`,
				seriesName: first.seriesName ?? `Series ${first.seriesId}`,
				seriesIndex: info?.sortOrder ?? 1,
				seriesId: first.seriesId,
				chapterId: first.chapterId,
				libraryId: first.libraryId,
				added: info?.added ?? "",
				authors: info?.authors ?? [],
				genres: info?.genres ?? [],
				annotations: group,
			},
		];
	});
};
