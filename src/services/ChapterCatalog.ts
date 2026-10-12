/**
 * Resolve book titles, authors, and genres for annotated chapters.
 *
 * @module
 */
import { Effect } from "effect";
import type { ChapterInfoMap } from "../formatters/markdown.js";
import type { ChapterInfo, Volume } from "../schemas.js";
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
 * Flatten a series' volumes into per-chapter book metadata.
 *
 * @since 2.0.0
 * @category Chapter Catalog
 */
export const toChapterInfo = (
	volumes: ReadonlyArray<Volume>,
): Array<ChapterInfo> =>
	volumes.flatMap((volume) =>
		volume.chapters.map(
			(chapter): ChapterInfo => ({
				chapterId: chapter.id,
				bookTitle:
					nonEmpty(chapter.titleName) ??
					nonEmpty(volume.name) ??
					`Volume ${volume.number}`,
				sortOrder: volume.number,
				authors: names(chapter.writers?.map((w) => w.name)),
				genres: names(chapter.genres?.map((g) => g.title)),
			}),
		),
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
