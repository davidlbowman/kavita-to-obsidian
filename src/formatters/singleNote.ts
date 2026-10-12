/**
 * The single-note layout: every book's highlights in one note, grouped by
 * series, book, and chapter.
 *
 * @module
 */
import { Array as Arr, Order, pipe } from "effect";
import type { Book, FormatOptions } from "../schemas.js";
import { byline } from "./bookNote.js";
import { renderChapters, visibleCount } from "./highlight.js";
import type { NoteContent } from "./note.js";

/**
 * Frontmatter keys the plugin writes to the single note.
 *
 * @since 2.0.0
 * @category Single Note
 */
export const SINGLE_NOTE_KEYS: ReadonlyArray<string> = [
	"title",
	"books",
	"highlights",
	"updated",
];

const bookOrder: Order.Order<Book> = Order.combine(
	Order.mapInput(Order.String, (b: Book) => b.seriesName),
	Order.mapInput(Order.Number, (b: Book) => b.seriesIndex),
);

/**
 * The synced section of the single note.
 *
 * @since 2.0.0
 * @category Single Note
 */
export const singleSection = (
	books: ReadonlyArray<Book>,
	options: FormatOptions,
	kavitaUrl: URL,
): string => {
	if (books.length === 0) {
		return "# Kavita highlights\n\n*No highlights yet. Highlight something in Kavita, then sync again.*";
	}
	const series: Array<Arr.NonEmptyArray<Book>> = [];
	for (const book of pipe(books, Arr.sort(bookOrder))) {
		const last = series.at(-1);
		if (last !== undefined && last[0].seriesName === book.seriesName) {
			last.push(book);
		} else {
			series.push([book]);
		}
	}
	return [
		"# Kavita highlights",
		...series.map((group) =>
			[
				`## ${group[0].seriesName}`,
				...group.map((book) =>
					[
						`### ${book.bookTitle}`,
						byline(book, options, kavitaUrl),
						renderChapters(book.annotations, options, kavitaUrl, 4),
					].join("\n\n"),
				),
			].join("\n\n"),
		),
	].join("\n\n");
};

/**
 * Everything the plugin writes into the single note.
 *
 * @since 2.0.0
 * @category Single Note
 */
export const singleNote = (
	books: ReadonlyArray<Book>,
	options: FormatOptions,
	kavitaUrl: URL,
): NoteContent => ({
	properties: {
		title: "Kavita highlights",
		books: books.length,
		highlights: books.reduce(
			(sum, book) => sum + visibleCount(book.annotations, options),
			0,
		),
		tags: options.includeTags ? ["kavita"] : [],
	},
	ownedKeys: SINGLE_NOTE_KEYS,
	isOwnedTag: (tag) => tag === "kavita",
	section: singleSection(books, options, kavitaUrl),
});
