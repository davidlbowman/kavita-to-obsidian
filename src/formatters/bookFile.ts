/**
 * Render one book's annotations as a standalone note for hierarchical mode.
 *
 * @module
 */
import { Array as Arr, pipe } from "effect";
import type { Annotation, BookFile, FormatOptions } from "../schemas.js";
import { formatAnnotation, makeWikilink, toSlug } from "./markdown.js";

/**
 * Frontmatter key that marks a note as written by this plugin.
 *
 * Orphan cleanup only ever trashes notes carrying this key.
 *
 * @since 2.0.0
 * @category Book File
 */
export const MANAGED_NOTE_KEY = "kavita_chapter_id";

/**
 * YAML frontmatter with tags and Kavita IDs.
 *
 * @since 1.1.0
 * @category Book File
 */
export const generateBookFrontmatter = (
	book: BookFile,
	options: FormatOptions,
	updated: string,
): string => {
	const tags = ["kavita"];
	const seriesSlug = toSlug(book.seriesName);
	if (seriesSlug) {
		tags.push(`series/${seriesSlug}`);
	}
	for (const author of book.authors) {
		const slug = toSlug(author);
		if (slug) {
			tags.push(`author/${slug}`);
		}
	}
	for (const genre of book.genres) {
		const slug = toSlug(genre);
		if (slug) {
			tags.push(`${options.tagPrefix || "genre/"}${slug}`);
		}
	}
	return [
		"---",
		"tags:",
		...tags.map((tag) => `  - ${tag}`),
		`kavita_series_id: ${book.seriesId}`,
		`${MANAGED_NOTE_KEY}: ${book.chapterId}`,
		`updated: ${updated}`,
		"---",
	].join("\n");
};

/**
 * Title, series, author, and genre lines.
 *
 * @since 1.1.0
 * @category Book File
 */
export const generateBookHeader = (
	book: BookFile,
	options: FormatOptions,
): string => {
	const link = (value: string) =>
		options.includeWikilinks ? makeWikilink(value) : value;
	const lines = [
		`# ${book.bookTitle}`,
		"",
		`**Series:** ${link(book.seriesName)}`,
	];
	if (book.authors.length > 0) {
		lines.push(`**Author:** ${book.authors.map(link).join(", ")}`);
	}
	if (book.genres.length > 0) {
		lines.push(`**Genres:** ${book.genres.join(", ")}`);
	}
	lines.push("", "---", "");
	return lines.join("\n");
};

/**
 * The `## Annotations` section.
 *
 * @since 1.1.0
 * @category Book File
 */
export const generateAnnotationsSection = (
	annotations: ReadonlyArray<Annotation>,
	options: FormatOptions,
): string => {
	if (annotations.length === 0) {
		return ["## Annotations", "", "*No annotations yet.*"].join("\n");
	}
	return [
		"## Annotations",
		"",
		...pipe(
			annotations,
			Arr.filterMap((a) => formatAnnotation(a, options)),
			Arr.flatMap((formatted) => [formatted, "", "---", ""]),
		),
	].join("\n");
};

/**
 * The complete note for one book.
 *
 * @since 1.1.0
 * @category Book File
 */
export const formatBookFile = (
	book: BookFile,
	options: FormatOptions,
	updated: string,
): string =>
	[
		generateBookFrontmatter(book, options, updated),
		"",
		generateBookHeader(book, options),
		generateAnnotationsSection(book.annotations, options),
	].join("\n");
