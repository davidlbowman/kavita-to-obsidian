/**
 * Links back into Kavita's web reader.
 *
 * @module
 */
import type { Annotation, Book } from "../schemas.js";

const withTrailingSlash = (base: URL): URL =>
	new URL(base.href.endsWith("/") ? base.href : `${base.href}/`);

/**
 * Kavita's reader URL for a book.
 *
 * @since 2.0.0
 * @category Links
 */
export const bookUrl = (
	base: URL,
	book: Pick<Book, "libraryId" | "seriesId" | "chapterId">,
): string =>
	new URL(
		`library/${book.libraryId}/series/${book.seriesId}/book/${book.chapterId}`,
		withTrailingSlash(base),
	).href;

/**
 * Kavita's reader URL that opens a book scrolled to one highlight.
 *
 * @since 2.0.0
 * @category Links
 */
export const annotationUrl = (base: URL, annotation: Annotation): string => {
	const url = new URL(bookUrl(base, annotation));
	url.searchParams.set("annotation", String(annotation.id));
	return url.href;
};
