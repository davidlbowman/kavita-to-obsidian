/**
 * Hierarchical export: one note per book under `Root / Series / Book.md`.
 *
 * @module
 */
import {
	Array as Arr,
	Context,
	DateTime,
	Effect,
	Layer,
	pipe,
	Record,
} from "effect";
import { normalizePath } from "obsidian";
import type {
	KavitaError,
	ObsidianFolderError,
	ObsidianWriteError,
} from "../errors.js";
import { formatBookFile } from "../formatters/bookFile.js";
import { type ChapterInfoMap, getSeriesName } from "../formatters/markdown.js";
import { buildSeriesPath, buildUniqueBookPath } from "../formatters/paths.js";
import type {
	Annotation,
	BookFile,
	HierarchicalSyncResult,
} from "../schemas.js";
import { fetchChapterInfo } from "./ChapterCatalog.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianVault } from "./ObsidianVault.js";
import { PluginConfig } from "./PluginConfig.js";

const entriesBy = (
	annotations: ReadonlyArray<Annotation>,
	key: (annotation: Annotation) => number,
): Array<Arr.NonEmptyArray<Annotation>> =>
	Record.values(Arr.groupBy(annotations, (a) => String(key(a))));

/**
 * Group annotations into one {@link BookFile} per chapter.
 *
 * @since 2.0.0
 * @category Syncer
 */
export const toBookFiles = (
	annotations: ReadonlyArray<Annotation>,
	chapterInfo: ChapterInfoMap,
): Array<Array<BookFile>> =>
	entriesBy(annotations, (a) => a.seriesId).map((series) =>
		entriesBy(series, (a) => a.chapterId).map((chapter): BookFile => {
			const first = chapter[0];
			const info = chapterInfo.get(first.chapterId);
			return {
				bookTitle:
					info?.bookTitle ?? first.chapterTitle ?? `Chapter ${first.chapterId}`,
				seriesName: getSeriesName(first),
				seriesId: first.seriesId,
				chapterId: first.chapterId,
				authors: info?.authors ?? [],
				genres: info?.genres ?? [],
				annotations: chapter,
			};
		}),
	);

const parentFolder = (path: string): string =>
	path.split("/").slice(0, -1).join("/");

/**
 * Writes one note per book and optionally trashes notes whose annotations
 * no longer exist.
 *
 * @since 1.1.0
 * @category Services
 */
export class HierarchicalSyncer extends Context.Service<
	HierarchicalSyncer,
	{
		readonly sync: Effect.Effect<
			HierarchicalSyncResult,
			KavitaError | ObsidianWriteError | ObsidianFolderError
		>;
	}
>()("kavita-to-obsidian/HierarchicalSyncer") {
	/**
	 * Requires `KavitaClient`, `ObsidianVault`, and `PluginConfig`.
	 *
	 * @since 1.1.0
	 * @category Layers
	 */
	static readonly layerNoDeps = Layer.effect(
		HierarchicalSyncer,
		Effect.gen(function* () {
			const kavita = yield* KavitaClient;
			const vault = yield* ObsidianVault;
			const config = yield* PluginConfig;
			const root = normalizePath(config.rootFolderName);

			const trashOrphans = Effect.fn("HierarchicalSyncer.trashOrphans")(
				function* (written: ReadonlySet<string>) {
					const orphans = (yield* vault.managedNotes(root)).filter(
						(path) => !written.has(path),
					);
					yield* Effect.forEach(orphans, (path) => vault.trashFile(path), {
						discard: true,
					});
					const emptied = pipe(
						orphans.map(parentFolder),
						Arr.dedupe,
						Arr.filter((folder) => folder !== root && folder !== ""),
					);
					yield* Effect.forEach(
						emptied,
						(folder) => vault.trashFolderIfEmpty(folder),
						{
							discard: true,
						},
					);
					return orphans.length;
				},
			);

			const sync = Effect.gen(function* () {
				const annotations = yield* kavita.annotations;
				const chapterInfo = yield* fetchChapterInfo(
					kavita,
					annotations.map((a) => a.seriesId),
				);
				const updated = DateTime.formatIso(yield* DateTime.now);
				const series = toBookFiles(annotations, chapterInfo);

				yield* vault.ensureFolder(root);
				const written = new Set<string>();
				let filesCreated = 0;
				let filesUpdated = 0;

				const seriesFolders = new Set<string>();

				for (const books of series) {
					for (const book of books) {
						const folder = buildSeriesPath(root, book.seriesName);
						if (!seriesFolders.has(folder)) {
							yield* vault.ensureFolder(folder);
							seriesFolders.add(folder);
						}
						const path = buildUniqueBookPath(
							root,
							book.seriesName,
							book.bookTitle,
							book.chapterId,
							written,
						);
						written.add(path);
						const outcome = yield* vault.writeFile(
							path,
							formatBookFile(book, config, updated),
						);
						if (outcome === "created") filesCreated++;
						else filesUpdated++;
					}
				}

				const filesDeleted =
					config.deleteOrphanedFiles && annotations.length > 0
						? yield* trashOrphans(written)
						: 0;

				return {
					annotationCount: annotations.length,
					seriesCount: series.length,
					bookCount: written.size,
					filesCreated,
					filesUpdated,
					filesDeleted,
				};
			}).pipe(Effect.withSpan("HierarchicalSyncer.sync"));

			return HierarchicalSyncer.of({ sync });
		}),
	);
}
