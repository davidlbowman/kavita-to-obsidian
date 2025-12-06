/**
 * Annotation syncer service for syncing Kavita annotations to Obsidian.
 *
 * @module
 */
import { Effect } from "effect";
import type {
	KavitaAuthError,
	KavitaNetworkError,
	KavitaParseError,
	ObsidianWriteError,
} from "../errors.js";
import {
	type ChapterInfoMap,
	type SeriesMetadataMap,
	toMarkdown,
} from "../formatters/markdown.js";
import type { SeriesMetadataDto } from "../schemas.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianAdapter } from "./ObsidianAdapter.js";
import { PluginConfig } from "./PluginConfig.js";

/**
 * Result of a sync operation.
 *
 * @since 0.0.1
 * @category Syncer
 */
export interface SyncResult {
	readonly count: number;
	readonly outputPath: string;
}

/**
 * Annotation syncer service.
 *
 * Orchestrates fetching annotations from Kavita and writing them to Obsidian.
 *
 * @since 0.0.1
 * @category Services
 */
export class AnnotationSyncer extends Effect.Service<AnnotationSyncer>()(
	"AnnotationSyncer",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const kavita = yield* KavitaClient;
			const obsidian = yield* ObsidianAdapter;
			const config = yield* PluginConfig;

			/**
			 * Fetch metadata for all unique series in the annotations.
			 *
			 * @since 0.0.2
			 */
			const fetchSeriesMetadata = (
				seriesIds: ReadonlyArray<number>,
			): Effect.Effect<
				SeriesMetadataMap,
				KavitaAuthError | KavitaNetworkError | KavitaParseError
			> =>
				Effect.gen(function* () {
					const metadataEntries: Array<
						[number, typeof SeriesMetadataDto.Type]
					> = [];

					for (const seriesId of seriesIds) {
						const metadata = yield* kavita
							.getSeriesMetadata(seriesId)
							.pipe(Effect.option);
						if (metadata._tag === "Some") {
							metadataEntries.push([seriesId, metadata.value]);
						}
					}

					return new Map(metadataEntries);
				});

			/**
			 * Fetch chapter info (book titles) for all unique series.
			 *
			 * @since 0.0.2
			 */
			const fetchChapterInfo = (
				seriesIds: ReadonlyArray<number>,
			): Effect.Effect<
				ChapterInfoMap,
				KavitaAuthError | KavitaNetworkError | KavitaParseError
			> =>
				Effect.gen(function* () {
					const chapterEntries: Array<
						[
							number,
							{ chapterId: number; bookTitle: string; sortOrder: number },
						]
					> = [];

					for (const seriesId of seriesIds) {
						const volumes = yield* kavita
							.getVolumes(seriesId)
							.pipe(Effect.option);
						if (volumes._tag === "Some") {
							for (const volume of volumes.value) {
								for (const chapter of volume.chapters) {
									const bookTitle =
										chapter.titleName ??
										volume.name ??
										`Volume ${volume.number}`;
									const sortOrder = volume.number;
									chapterEntries.push([
										chapter.id,
										{ chapterId: chapter.id, bookTitle, sortOrder },
									]);
								}
							}
						}
					}

					return new Map(chapterEntries);
				});

			/**
			 * Sync all annotations to a single file.
			 *
			 * @since 0.0.1
			 */
			const syncToFile: Effect.Effect<
				SyncResult,
				| KavitaAuthError
				| KavitaNetworkError
				| KavitaParseError
				| ObsidianWriteError
			> = Effect.gen(function* () {
				const annotations = yield* kavita.fetchAllAnnotations;

				const uniqueSeriesIds = [
					...new Set(annotations.map((a) => a.seriesId)),
				];
				const metadataMap = yield* fetchSeriesMetadata(uniqueSeriesIds);
				const chapterInfoMap = yield* fetchChapterInfo(uniqueSeriesIds);

				const markdown = toMarkdown(
					annotations,
					{
						includeComments: config.includeComments,
						includeSpoilers: config.includeSpoilers,
						includeTags: config.includeTags,
						tagPrefix: config.tagPrefix,
						includeWikilinks: config.includeWikilinks,
					},
					metadataMap,
					chapterInfoMap,
				);

				yield* obsidian.writeFile(config.outputPath, markdown);

				return {
					count: annotations.length,
					outputPath: config.outputPath,
				};
			});

			return { syncToFile };
		}),
	},
) {}
