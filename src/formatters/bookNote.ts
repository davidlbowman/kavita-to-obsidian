/**
 * The note for one book: Bases-friendly properties and a readable section
 * with the cover, byline, and highlights grouped by chapter. The note's file
 * name is the book title, which Obsidian shows as the note's title.
 *
 * @module
 */
import type { Book, FormatOptions } from "../schemas.js";
import { renderChapters, visibleCount } from "./highlight.js";
import { bookUrl } from "./links.js";
import type { NoteContent } from "./note.js";

/**
 * Frontmatter key that marks a note as a Kavita book note. Notes are found
 * by this key, so renaming or moving them is safe.
 *
 * @since 2.0.0
 * @category Book Note
 */
export const MANAGED_NOTE_KEY = "kavita_chapter_id";

/**
 * Frontmatter key holding when Kavita added the book. Together with
 * {@link MANAGED_NOTE_KEY} it identifies the book across Kavita servers and
 * library rebuilds, which reuse chapter ids.
 *
 * @since 2.0.0
 * @category Book Note
 */
export const ADDED_KEY = "kavita_added";

/**
 * Every frontmatter key the plugin writes to book notes, plus retired ones it
 * cleans up. Any other key belongs to the user.
 *
 * @since 2.0.0
 * @category Book Note
 */
export const BOOK_NOTE_KEYS: ReadonlyArray<string> = [
	"title",
	"author",
	"series",
	"series_index",
	"genres",
	"cover",
	"highlights",
	"last_highlighted",
	"kavita_url",
	"kavita_series_id",
	MANAGED_NOTE_KEY,
	ADDED_KEY,
	"updated",
];

/**
 * Lowercase, hyphenated slug for tags.
 *
 * @since 0.0.2
 * @category Book Note
 */
export const toSlug = (input: string): string =>
	input
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

/**
 * `[[link]]` or plain text, per the wikilink setting.
 *
 * @since 2.0.0
 * @category Book Note
 */
export const linkOrText = (value: string, options: FormatOptions): string =>
	options.includeWikilinks ? `[[${value}]]` : value;

/**
 * Tags the plugin generates for a book.
 *
 * @since 1.1.0
 * @category Book Note
 */
export const bookTags = (book: Book, options: FormatOptions): Array<string> => {
	if (!options.includeTags) return [];
	const tags = ["kavita"];
	const series = toSlug(book.seriesName);
	if (series) tags.push(`series/${series}`);
	for (const author of book.authors) {
		const slug = toSlug(author);
		if (slug) tags.push(`author/${slug}`);
	}
	for (const genre of book.genres) {
		const slug = toSlug(genre);
		if (slug) tags.push(`${options.tagPrefix || "genre/"}${slug}`);
	}
	return [...new Set(tags)];
};

/**
 * Whether a tag is one the plugin generates, and may be replaced on sync.
 *
 * @since 2.0.0
 * @category Book Note
 */
export const isGeneratedTag =
	(options: FormatOptions) =>
	(tag: string): boolean =>
		tag === "kavita" ||
		tag.startsWith("series/") ||
		tag.startsWith("author/") ||
		tag.startsWith("genre/") ||
		(options.tagPrefix !== "" && tag.startsWith(options.tagPrefix));

const lastHighlighted = (book: Book): string | undefined =>
	book.annotations
		.map((a) => a.lastModifiedUtc || a.createdUtc)
		.toSorted()
		.at(-1)
		?.slice(0, 10);

/**
 * Bases-friendly properties for a book note.
 *
 * @since 2.0.0
 * @category Book Note
 */
export const bookProperties = (
	book: Book,
	options: FormatOptions,
	kavitaUrl: URL,
	coverPath: string | undefined,
): Record<string, unknown> => {
	const properties: Record<string, unknown> = {
		title: book.bookTitle,
		author: book.authors.map((a) => linkOrText(a, options)),
		series: linkOrText(book.seriesName, options),
		series_index: book.seriesIndex,
		genres: [...book.genres],
	};
	if (coverPath !== undefined) properties.cover = `[[${coverPath}]]`;
	properties.highlights = visibleCount(book.annotations, options);
	const last = lastHighlighted(book);
	if (last !== undefined) properties.last_highlighted = last;
	properties.kavita_url = bookUrl(kavitaUrl, book);
	properties.kavita_series_id = book.seriesId;
	properties[MANAGED_NOTE_KEY] = book.chapterId;
	if (book.added !== "") properties[ADDED_KEY] = book.added;
	const tags = bookTags(book, options);
	if (tags.length > 0) properties.tags = tags;
	return properties;
};

/**
 * "by Author · Series #2 · Open in Kavita".
 *
 * @since 2.0.0
 * @category Book Note
 */
export const byline = (
	book: Book,
	options: FormatOptions,
	kavitaUrl: URL,
): string => {
	const parts: Array<string> = [];
	if (book.authors.length > 0) {
		parts.push(
			`by ${book.authors.map((a) => linkOrText(a, options)).join(", ")}`,
		);
	}
	if (book.seriesName !== book.bookTitle) {
		parts.push(`${linkOrText(book.seriesName, options)} #${book.seriesIndex}`);
	}
	parts.push(`[Open in Kavita](${bookUrl(kavitaUrl, book)})`);
	return parts.join(" · ");
};

/**
 * The synced section of a book note.
 *
 * @since 2.0.0
 * @category Book Note
 */
export const bookSection = (
	book: Book,
	options: FormatOptions,
	kavitaUrl: URL,
	coverPath: string | undefined,
): string =>
	[
		...(coverPath === undefined ? [] : [`![[${coverPath}|160]]`]),
		byline(book, options, kavitaUrl),
		renderChapters(book.annotations, options, kavitaUrl, 2),
	].join("\n\n");

/**
 * Everything the plugin writes into a book note.
 *
 * @since 2.0.0
 * @category Book Note
 */
export const bookNote = (
	book: Book,
	options: FormatOptions,
	kavitaUrl: URL,
	coverPath: string | undefined,
): NoteContent => ({
	properties: bookProperties(book, options, kavitaUrl, coverPath),
	ownedKeys: BOOK_NOTE_KEYS,
	isOwnedTag: isGeneratedTag(options),
	section: bookSection(book, options, kavitaUrl, coverPath),
});
