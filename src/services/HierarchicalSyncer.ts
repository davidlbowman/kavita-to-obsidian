/**
 * Hierarchical syncer service for organizing annotations by series/book folders.
 *
 * @module
 */

import { Array, Effect, Record } from "effect";
import { normalizePath } from "obsidian";
import type {
	KavitaAuthError,
	KavitaNetworkError,
	KavitaParseError,
	ObsidianFolderError,
	ObsidianWriteError,
} from "../errors.js";
import {
	type BookFileOptions,
	formatBookFile,
} from "../formatters/bookFile.js";
import { buildSeriesPath, buildUniqueBookPath } from "../formatters/paths.js";
import type { AnnotationDto } from "../schemas.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianAdapter } from "./ObsidianAdapter.js";
import { PluginConfig } from "./PluginConfig.js";

/**
 * Result of a hierarchical sync operation.
 *
 * @since 1.1.0
 * @category Syncer
 */
export interface HierarchicalSyncResult {
	readonly totalAnnotations: number;
	readonly seriesCount: number;
	readonly bookCount: number;
	readonly filesCreated: number;
	readonly filesUpdated: number;
}

/**
 * Book info extracted from annotations and metadata.
 *
 * @since 1.1.0
 * @category Syncer
 */
interface BookInfo {
	readonly bookTitle: string;
	readonly seriesName: string;
	readonly seriesId: number;
	readonly chapterId: number;
	readonly authors: ReadonlyArray<string>;
	readonly genres: ReadonlyArray<string>;
	readonly annotations: ReadonlyArray<typeof AnnotationDto.Type>;
}

/**
 * Group annotations by series ID.
 *
 * @since 1.1.0
 * @category Syncer
 */
const groupBySeriesId = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
): Record.ReadonlyRecord<string, globalThis.Array<typeof AnnotationDto.Type>> =>
	Array.groupBy(annotations, (a) => String(a.seriesId));

/**
 * Group annotations by chapter ID within a series.
 *
 * @since 1.1.0
 * @category Syncer
 */
const groupByChapterId = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
): Record.ReadonlyRecord<string, globalThis.Array<typeof AnnotationDto.Type>> =>
	Array.groupBy(annotations, (a) => String(a.chapterId));

/**
 * Hierarchical syncer service.
 *
 * Syncs annotations to a folder structure: Root / Series / Book.md
 *
 * @since 1.1.0
 * @category Services
 */
export class HierarchicalSyncer extends Effect.Service<HierarchicalSyncer>()(
	"HierarchicalSyncer",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const kavita = yield* KavitaClient;
			const obsidian = yield* ObsidianAdapter;
			const config = yield* PluginConfig;

			/**
			 * Extract book info from a chapter's annotations.
			 *
			 * @since 1.1.0
			 */
			const extractBookInfo = (
				chapterId: number,
				annotations: ReadonlyArray<typeof AnnotationDto.Type>,
				volumeInfo: Map<
					number,
					{
						bookTitle: string;
						authors: string[];
						genres: string[];
					}
				>,
			): BookInfo => {
				const firstAnnotation = annotations[0];
				if (!firstAnnotation) {
					return {
						bookTitle: `Chapter ${chapterId}`,
						seriesName: "Unknown Series",
						seriesId: 0,
						chapterId,
						authors: [],
						genres: [],
						annotations,
					};
				}

				const info = volumeInfo.get(chapterId);
				const bookTitle =
					info?.bookTitle ??
					firstAnnotation.chapterTitle ??
					`Chapter ${chapterId}`;
				const seriesName =
					firstAnnotation.seriesName ?? `Series ${firstAnnotation.seriesId}`;

				return {
					bookTitle,
					seriesName,
					seriesId: firstAnnotation.seriesId,
					chapterId,
					authors: info?.authors ?? [],
					genres: info?.genres ?? [],
					annotations,
				};
			};

			/**
			 * Fetch chapter/volume metadata for book titles and authors.
			 *
			 * @since 1.1.0
			 */
			const fetchVolumeInfo = (
				seriesIds: ReadonlyArray<number>,
			): Effect.Effect<
				Map<
					number,
					{
						bookTitle: string;
						authors: string[];
						genres: string[];
					}
				>,
				KavitaAuthError | KavitaNetworkError | KavitaParseError
			> =>
				Effect.gen(function* () {
					const infoMap = new Map<
						number,
						{ bookTitle: string; authors: string[]; genres: string[] }
					>();

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
									const authors = (chapter.writers ?? []).map((w) => w.name);
									const genres = (chapter.genres ?? []).map((g) => g.title);
									infoMap.set(chapter.id, { bookTitle, authors, genres });
								}
							}
						}
					}

					return infoMap;
				});

			/**
			 * Sync all annotations to hierarchical folder structure.
			 *
			 * @since 1.1.0
			 */
			const syncAll: Effect.Effect<
				HierarchicalSyncResult,
				| KavitaAuthError
				| KavitaNetworkError
				| KavitaParseError
				| ObsidianWriteError
				| ObsidianFolderError
			> = Effect.gen(function* () {
				const annotations = yield* kavita.fetchAllAnnotations;

				if (annotations.length === 0) {
					return {
						totalAnnotations: 0,
						seriesCount: 0,
						bookCount: 0,
						filesCreated: 0,
						filesUpdated: 0,
					};
				}

				const uniqueSeriesIds = [
					...new Set(annotations.map((a) => a.seriesId)),
				];
				const volumeInfo = yield* fetchVolumeInfo(uniqueSeriesIds);

				yield* obsidian.ensureFolderExists(
					normalizePath(config.rootFolderName),
				);

				const seriesGroups = groupBySeriesId(annotations);
				const seriesEntries = Record.toEntries(seriesGroups);

				let filesCreated = 0;
				let filesUpdated = 0;
				let bookCount = 0;
				const usedPaths = new Set<string>();

				for (const [, seriesAnnotations] of seriesEntries) {
					const firstAnnotation = seriesAnnotations[0];
					if (!firstAnnotation) continue;

					const seriesName =
						firstAnnotation.seriesName ?? `Series ${firstAnnotation.seriesId}`;
					const seriesPath = buildSeriesPath(config.rootFolderName, seriesName);

					yield* obsidian.ensureFolderExists(seriesPath);

					const chapterGroups = groupByChapterId(seriesAnnotations);
					const chapterEntries = Record.toEntries(chapterGroups);

					for (const [chapterIdStr, chapterAnnotations] of chapterEntries) {
						const chapterId = Number.parseInt(chapterIdStr, 10);
						const bookInfo = extractBookInfo(
							chapterId,
							chapterAnnotations,
							volumeInfo,
						);

						const bookPath = buildUniqueBookPath(
							config.rootFolderName,
							bookInfo.seriesName,
							bookInfo.bookTitle,
							chapterId,
							usedPaths,
						);
						usedPaths.add(bookPath);

						const bookOptions: BookFileOptions = {
							bookTitle: bookInfo.bookTitle,
							seriesName: bookInfo.seriesName,
							seriesId: bookInfo.seriesId,
							chapterId: bookInfo.chapterId,
							authors: bookInfo.authors,
							genres: bookInfo.genres,
							annotations: bookInfo.annotations,
							formatOptions: {
								includeComments: config.includeComments,
								includeSpoilers: config.includeSpoilers,
								includeTags: config.includeTags,
								tagPrefix: config.tagPrefix,
								includeWikilinks: config.includeWikilinks,
								annotationTemplate: config.annotationTemplate,
							},
						};

						const content = formatBookFile(bookOptions);

						const existingFile = yield* obsidian.getFile(bookPath);
						if (existingFile._tag === "Some") {
							filesUpdated++;
						} else {
							filesCreated++;
						}

						yield* obsidian.writeFile(bookPath, content);
						bookCount++;
					}
				}

				return {
					totalAnnotations: annotations.length,
					seriesCount: seriesEntries.length,
					bookCount,
					filesCreated,
					filesUpdated,
				};
			});

			return { syncAll };
		}),
	},
) {}
