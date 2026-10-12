/**
 * Sync Kavita highlights into notes: one note per book, or one single note.
 *
 * @module
 */
import { Context, Effect, Layer, Option } from "effect";
import { normalizePath } from "obsidian";
import type {
	KavitaError,
	ObsidianFolderError,
	ObsidianWriteError,
} from "../errors.js";
import { bookNote } from "../formatters/bookNote.js";
import { visibleCount } from "../formatters/highlight.js";
import { libraryBase } from "../formatters/library.js";
import {
	mergeNote,
	type NoteContent,
	syncedHighlightIds,
} from "../formatters/note.js";
import {
	buildBookPath,
	buildCoverPath,
	buildLibraryPath,
	buildSeriesPath,
	buildUniqueBookPath,
	COVERS_FOLDER,
} from "../formatters/paths.js";
import { singleNote } from "../formatters/singleNote.js";
import type { Book, SyncSummary } from "../schemas.js";
import { fetchChapterInfo, toBooks } from "./ChapterCatalog.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianVault, type WriteOutcome } from "./ObsidianVault.js";
import { PluginConfig } from "./PluginConfig.js";
import { SyncProgress } from "./SyncProgress.js";

const COVER_EXTENSIONS = ["png", "jpg", "webp", "gif"];

const parentFolder = (path: string): string =>
	path.split("/").slice(0, -1).join("/");

const isInside = (folder: string) => (path: string) =>
	path.startsWith(`${folder}/`);

interface NoteWrite {
	readonly outcome: WriteOutcome;
	readonly newHighlights: number;
}

const tally = (writes: ReadonlyArray<NoteWrite>) => ({
	newHighlights: writes.reduce((sum, w) => sum + w.newHighlights, 0),
	notesCreated: writes.filter((w) => w.outcome === "created").length,
	notesUpdated: writes.filter((w) => w.outcome === "updated").length,
	notesUnchanged: writes.filter((w) => w.outcome === "unchanged").length,
});

/**
 * Writes Kavita highlights into the vault in the configured layout.
 *
 * @since 2.0.0
 * @category Services
 */
export class NoteSync extends Context.Service<
	NoteSync,
	{
		readonly sync: Effect.Effect<
			SyncSummary,
			KavitaError | ObsidianWriteError | ObsidianFolderError
		>;
	}
>()("kavita-to-obsidian/NoteSync") {
	/**
	 * Requires `KavitaClient`, `ObsidianVault`, and `PluginConfig`.
	 *
	 * @since 2.0.0
	 * @category Layers
	 */
	static readonly layerNoDeps = Layer.effect(
		NoteSync,
		Effect.gen(function* () {
			const kavita = yield* KavitaClient;
			const vault = yield* ObsidianVault;
			const config = yield* PluginConfig;
			const root = normalizePath(config.rootFolderName);

			const writeNote = Effect.fnUntraced(function* (
				path: string,
				content: NoteContent,
			) {
				const existing = Option.getOrUndefined(yield* vault.readText(path));
				const text = mergeNote(existing, content);
				const before =
					existing === undefined ? new Set() : syncedHighlightIds(existing);
				const newHighlights = [...syncedHighlightIds(text)].filter(
					(id) => !before.has(id),
				).length;
				const outcome = yield* vault.writeText(path, text);
				return { outcome, newHighlights };
			});

			const loadBooks = Effect.gen(function* () {
				const progress = yield* SyncProgress;
				yield* progress.report("Fetching your highlights…");
				const annotations = yield* kavita.annotations;
				yield* progress.report("Looking up book details…");
				const catalog = yield* fetchChapterInfo(
					kavita,
					annotations.map((a) => a.seriesId),
				);
				return toBooks(annotations, catalog);
			});

			const coverFor = Effect.fnUntraced(function* (book: Book) {
				for (const extension of COVER_EXTENSIONS) {
					const path = buildCoverPath(root, book.chapterId, extension);
					if (yield* vault.exists(path)) return Option.some(path);
				}
				const image = yield* kavita.cover(book.chapterId);
				if (Option.isNone(image)) return Option.none<string>();
				yield* vault.ensureFolder(normalizePath(`${root}/${COVERS_FOLDER}`));
				const path = buildCoverPath(
					root,
					book.chapterId,
					image.value.extension,
				);
				yield* vault.writeBinaryIfMissing(path, image.value.data);
				return Option.some(path);
			});

			const safeCover = (book: Book) =>
				coverFor(book).pipe(
					Effect.catch((error) =>
						Effect.logWarning(`No cover for "${book.bookTitle}"`, error).pipe(
							Effect.as(Option.none<string>()),
						),
					),
				);

			const trashOrphans = Effect.fn("NoteSync.trashOrphans")(function* (
				orphans: ReadonlyArray<string>,
			) {
				yield* Effect.forEach(orphans, (path) => vault.trashFile(path), {
					discard: true,
				});
				const folders = [...new Set(orphans.map(parentFolder))].filter(
					(folder) => folder !== root && folder !== "",
				);
				yield* Effect.forEach(
					folders,
					(folder) => vault.trashFolderIfEmpty(folder),
					{ discard: true },
				);
			});

			const syncBooks = Effect.gen(function* () {
				const progress = yield* SyncProgress;
				const books = yield* loadBooks;
				yield* vault.ensureFolder(root);
				const existing = new Map(
					(yield* vault.bookNotes).map((ref) => [ref.chapterId, ref.path]),
				);
				const written = new Set<string>();
				const writes: Array<NoteWrite> = [];

				for (const [index, book] of books.entries()) {
					yield* progress.report(
						`Writing ${index + 1} of ${books.length}: ${book.bookTitle}`,
					);
					const cover = config.downloadCovers
						? Option.getOrUndefined(yield* safeCover(book))
						: undefined;
					const known = existing.get(book.chapterId);
					let path = known;
					if (path === undefined) {
						const base = buildBookPath(root, book.seriesName, book.bookTitle);
						const taken = written.has(base) || (yield* vault.exists(base));
						path = taken
							? buildUniqueBookPath(
									root,
									book.seriesName,
									book.bookTitle,
									book.chapterId,
									new Set([base]),
								)
							: base;
						yield* vault.ensureFolder(buildSeriesPath(root, book.seriesName));
					}
					written.add(path);
					writes.push(
						yield* writeNote(
							path,
							bookNote(book, config, config.kavitaUrl, cover),
						),
					);
				}

				const synced = new Set(books.map((b) => b.chapterId));
				const orphans =
					config.deleteOrphanedFiles && books.length > 0
						? [...existing]
								.filter(([chapterId]) => !synced.has(chapterId))
								.map(([, path]) => path)
								.filter(isInside(root))
						: [];
				yield* trashOrphans(orphans);

				const library = buildLibraryPath(root);
				if (config.createLibraryView && !(yield* vault.exists(library))) {
					yield* vault.writeText(library, libraryBase(root));
				}

				const summary: SyncSummary = {
					highlights: books.reduce(
						(sum, b) => sum + visibleCount(b.annotations, config),
						0,
					),
					books: books.length,
					...tally(writes),
					notesDeleted: orphans.length,
					openPath: config.createLibraryView
						? library
						: ([...written][0] ?? root),
				};
				return summary;
			});

			const syncSingle = Effect.gen(function* () {
				const progress = yield* SyncProgress;
				const books = yield* loadBooks;
				yield* progress.report("Writing your highlights note…");
				const path = normalizePath(config.outputPath);
				const parent = parentFolder(path);
				if (parent !== "") yield* vault.ensureFolder(parent);
				const write = yield* writeNote(
					path,
					singleNote(books, config, config.kavitaUrl),
				);
				const summary: SyncSummary = {
					highlights: books.reduce(
						(sum, b) => sum + visibleCount(b.annotations, config),
						0,
					),
					books: books.length,
					...tally([write]),
					notesDeleted: 0,
					openPath: path,
				};
				return summary;
			});

			return NoteSync.of({
				sync: (config.exportMode === "single-file"
					? syncSingle
					: syncBooks
				).pipe(Effect.withSpan("NoteSync.sync")),
			});
		}),
	);
}
