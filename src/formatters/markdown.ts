/**
 * Pure formatting functions for converting annotations to markdown.
 *
 * @module
 */
import {
	Array,
	Number as EffectNumber,
	Option,
	Order,
	pipe,
	Record,
} from "effect";
import type { AnnotationDto, SeriesMetadataDto } from "../schemas.js";

/**
 * Map of seriesId to series metadata.
 *
 * @since 0.0.2
 * @category Formatters
 */
export type SeriesMetadataMap = ReadonlyMap<
	number,
	typeof SeriesMetadataDto.Type
>;

/**
 * Information about a chapter including its book title and metadata.
 *
 * @since 0.0.2
 * @category Formatters
 */
export interface ChapterInfo {
	readonly chapterId: number;
	readonly bookTitle: string;
	readonly sortOrder: number;
	readonly authors: ReadonlyArray<string>;
	readonly genres: ReadonlyArray<string>;
}

/**
 * Map of chapterId to chapter info (including book title).
 *
 * @since 0.0.2
 * @category Formatters
 */
export type ChapterInfoMap = ReadonlyMap<number, ChapterInfo>;

/**
 * Options for formatting annotations.
 *
 * @since 0.0.1
 * @category Formatters
 */
export interface FormatOptions {
	readonly includeComments: boolean;
	readonly includeSpoilers: boolean;
	/** @since 0.0.2 */
	readonly includeTags: boolean;
	/** @since 0.0.2 */
	readonly tagPrefix: string;
	/** @since 0.0.2 */
	readonly includeWikilinks: boolean;
}

/**
 * Convert a string to a URL-safe slug for tags.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const toSlug = (input: string): string =>
	input
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

/**
 * Generate a tag from a value with optional prefix.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const makeTag = (value: string, prefix = ""): string =>
	`#${prefix}${toSlug(value)}`;

/**
 * Generate a wikilink.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const makeWikilink = (value: string): string => `[[${value}]]`;

/**
 * Extract plain text from Quill Delta JSON format.
 *
 * Quill Delta is a rich text format used by the Quill editor.
 * This function extracts only the plain text from insert operations.
 *
 * Limitations:
 * - Only extracts text from 'insert' operations
 * - Ignores formatting attributes (bold, italic, links, etc.)
 * - Ignores retain/delete operations
 * - Ignores embedded objects (images, etc.)
 *
 * @example
 * ```ts
 * extractTextFromQuillDelta('{"ops":[{"insert":"Hello\\n"}]}') // "Hello"
 * extractTextFromQuillDelta('{"ops":[{"retain":5}]}') // null
 * extractTextFromQuillDelta('plain text') // null
 * ```
 *
 * @since 1.1.2
 * @category Formatters
 */
export const extractTextFromQuillDelta = (deltaJson: string): string | null => {
	const trimmed = deltaJson.trim();

	// Early exit for non-JSON strings (performance optimization)
	if (!trimmed.startsWith("{")) {
		return null;
	}

	try {
		const delta = JSON.parse(trimmed) as unknown;

		// Validate structure
		if (
			!delta ||
			typeof delta !== "object" ||
			!("ops" in delta) ||
			!Array.isArray((delta as { ops: unknown }).ops)
		) {
			return null;
		}

		const ops = (delta as { ops: unknown[] }).ops;
		if (ops.length === 0) {
			return null;
		}

		const textParts: string[] = [];

		for (const op of ops) {
			if (op && typeof op === "object" && "insert" in op) {
				const insert = (op as { insert: unknown }).insert;
				// Only handle string inserts, ignore embeds (objects) and other types
				if (typeof insert === "string") {
					textParts.push(insert);
				}
			}
			// Ignore retain/delete operations - they don't contain text
		}

		const text = textParts.join("").trim();
		return text || null;
	} catch {
		// Invalid JSON - not a Quill Delta
		return null;
	}
};

/**
 * Get the comment text from an annotation, preferring plain text over Quill Delta.
 *
 * Priority:
 * 1. `commentPlainText` (if available and non-empty)
 * 2. Parsed Quill Delta JSON from `comment` (if valid JSON starting with `{`)
 * 3. Plain text `comment` (if not JSON-like)
 * 4. `null` (for invalid/empty comments or unparseable JSON)
 *
 * @example
 * ```ts
 * // With commentPlainText
 * getCommentText({ commentPlainText: "My note", comment: '{"ops":[...]}' }) // "My note"
 *
 * // With Quill Delta
 * getCommentText({ commentPlainText: null, comment: '{"ops":[{"insert":"My note\\n"}]}' }) // "My note"
 *
 * // With plain text comment
 * getCommentText({ commentPlainText: null, comment: 'Plain text' }) // "Plain text"
 *
 * // With malformed JSON (returns null to avoid exposing raw JSON)
 * getCommentText({ commentPlainText: null, comment: '{"ops":invalid}' }) // null
 * ```
 *
 * @since 1.1.2
 * @category Formatters
 */
export const getCommentText = (
	annotation: typeof AnnotationDto.Type,
): string | null => {
	// Priority 1: Use commentPlainText if available
	if (annotation.commentPlainText) {
		const trimmed = annotation.commentPlainText.trim();
		if (trimmed) {
			return trimmed;
		}
	}

	// Priority 2/3: Handle comment field
	if (annotation.comment) {
		const trimmed = annotation.comment.trim();
		if (!trimmed || trimmed === "{}") {
			return null;
		}

		// If it looks like JSON, try to parse as Quill Delta
		if (trimmed.startsWith("{")) {
			const extracted = extractTextFromQuillDelta(trimmed);
			if (extracted) {
				return extracted;
			}
			// Failed to parse as Quill Delta - return null to avoid exposing raw JSON
			return null;
		}

		// Not JSON-like, treat as plain text
		return trimmed;
	}

	return null;
};

/**
 * Format a single annotation to markdown.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const formatAnnotation = (
	annotation: typeof AnnotationDto.Type,
	options: FormatOptions,
): Option.Option<string> => {
	if (annotation.containsSpoiler && !options.includeSpoilers) {
		return Option.none();
	}

	const lines: string[] = [];

	const content = annotation.selectedText ?? "";
	const blockquote = content
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n");
	lines.push(blockquote);

	const commentText = getCommentText(annotation);

	if (options.includeComments && commentText) {
		lines.push("");
		lines.push(`*Note:* ${commentText}`);
	}

	if (annotation.pageNumber !== undefined && annotation.pageNumber > 0) {
		lines.push("");
		lines.push(`<small>Page ${annotation.pageNumber}</small>`);
	}

	return Option.some(lines.join("\n"));
};

/**
 * Get the series name from an annotation, falling back to ID.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getSeriesName = (annotation: typeof AnnotationDto.Type): string =>
	annotation.seriesName ?? `Series ${annotation.seriesId}`;

/**
 * Get the chapter title from an annotation, falling back to ID.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getChapterTitle = (
	annotation: typeof AnnotationDto.Type,
): string => annotation.chapterTitle ?? `Chapter ${annotation.chapterId}`;

/**
 * Get the library name from an annotation, falling back to ID.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getLibraryName = (annotation: typeof AnnotationDto.Type): string =>
	annotation.libraryName ?? `Library ${annotation.libraryId}`;

/**
 * Get the book title from chapter info map, falling back to series name.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getBookTitle = (
	annotation: typeof AnnotationDto.Type,
	chapterInfoMap?: ChapterInfoMap,
): string => {
	const chapterInfo = chapterInfoMap?.get(annotation.chapterId);
	return chapterInfo?.bookTitle ?? getSeriesName(annotation);
};

/**
 * Get authors for a book from the first annotation's chapter info.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getBookAuthors = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	chapterInfoMap?: ChapterInfoMap,
): ReadonlyArray<string> => {
	const firstAnnotation = annotations[0];
	if (!firstAnnotation || !chapterInfoMap) return [];
	const chapterInfo = chapterInfoMap.get(firstAnnotation.chapterId);
	return chapterInfo?.authors ?? [];
};

/**
 * Get genres for a book from the first annotation's chapter info.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getBookGenres = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	chapterInfoMap?: ChapterInfoMap,
): ReadonlyArray<string> => {
	const firstAnnotation = annotations[0];
	if (!firstAnnotation || !chapterInfoMap) return [];
	const chapterInfo = chapterInfoMap.get(firstAnnotation.chapterId);
	return chapterInfo?.genres ?? [];
};

/**
 * Group annotations by seriesId.
 *
 * @since 0.0.1
 * @category Formatters
 */
export const groupBySeriesId = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
): Record.ReadonlyRecord<string, globalThis.Array<typeof AnnotationDto.Type>> =>
	Array.groupBy(annotations, (a) => String(a.seriesId));

/**
 * Group annotations by chapterId.
 *
 * @since 0.0.1
 * @category Formatters
 */
export const groupByChapterId = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
): Record.ReadonlyRecord<string, globalThis.Array<typeof AnnotationDto.Type>> =>
	Array.groupBy(annotations, (a) => String(a.chapterId));

/**
 * Group annotations by book title.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const groupByBookTitle = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	chapterInfoMap?: ChapterInfoMap,
): Record.ReadonlyRecord<string, globalThis.Array<typeof AnnotationDto.Type>> =>
	Array.groupBy(annotations, (a) => getBookTitle(a, chapterInfoMap));

/**
 * Get the sort order for a book title from the chapter info map.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getBookSortOrder = (
	_bookTitle: string,
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	chapterInfoMap?: ChapterInfoMap,
): number => {
	const firstAnnotation = annotations[0];
	if (!firstAnnotation || !chapterInfoMap) return 0;
	const chapterInfo = chapterInfoMap.get(firstAnnotation.chapterId);
	return chapterInfo?.sortOrder ?? 0;
};

/**
 * Get book groups sorted by series order.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getSortedBookGroups = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	chapterInfoMap?: ChapterInfoMap,
): globalThis.Array<[string, globalThis.Array<typeof AnnotationDto.Type>]> => {
	const groups = groupByBookTitle(annotations, chapterInfoMap);
	const bookOrder = Order.mapInput(
		EffectNumber.Order,
		(entry: [string, globalThis.Array<typeof AnnotationDto.Type>]) =>
			getBookSortOrder(entry[0], entry[1], chapterInfoMap),
	);
	return pipe(Record.toEntries(groups), Array.sort(bookOrder));
};

/**
 * Generate book header with title and tags.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const generateBookHeader = (
	bookTitle: string,
	options: FormatOptions,
	authors: ReadonlyArray<string> = [],
	genres: ReadonlyArray<string> = [],
): string[] => {
	const lines: string[] = [`### ${bookTitle}`];

	if (authors.length > 0) {
		if (options.includeWikilinks) {
			const authorLinks = authors.map(makeWikilink).join(", ");
			lines.push(`**Author:** ${authorLinks}`);
		} else {
			lines.push(`**Author:** ${authors.join(", ")}`);
		}
	}

	if (options.includeWikilinks) {
		lines.push(`**Book:** ${makeWikilink(bookTitle)}`);
	}

	if (genres.length > 0) {
		lines.push(`**Genres:** ${genres.join(", ")}`);
	}

	if (options.includeTags && genres.length > 0) {
		const tags = genres.map((g) => makeTag(g, options.tagPrefix));
		lines.push(`**Tags:** ${tags.join(" ")}`);
	}

	return lines;
};

/**
 * Generate YAML frontmatter for the annotations document.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const generateFrontmatter = (options: FormatOptions): string => {
	const lines = ["---", "title: Kavita Annotations"];

	if (options.includeTags) {
		lines.push("tags:");
		lines.push("  - annotations");
		lines.push("  - kavita");
	}

	lines.push(`updated: ${new Date().toISOString()}`);
	lines.push("---");

	return lines.join("\n");
};

/**
 * Get author names from series metadata.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getAuthorNames = (
	metadata: typeof SeriesMetadataDto.Type | undefined,
): string[] => {
	if (!metadata?.writers?.length) return [];
	return metadata.writers.map((w) => w.name);
};

/**
 * Get genre names from series metadata.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getGenreNames = (
	metadata: typeof SeriesMetadataDto.Type | undefined,
): string[] => {
	if (!metadata?.genres?.length) return [];
	return metadata.genres.map((g) => g.title);
};

/**
 * Generate series header with metadata.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const generateSeriesHeader = (
	firstAnnotation: typeof AnnotationDto.Type,
	options: FormatOptions,
	_metadata?: typeof SeriesMetadataDto.Type,
): string[] => {
	const seriesName = getSeriesName(firstAnnotation);
	const libraryName = getLibraryName(firstAnnotation);

	const lines: string[] = [`## ${seriesName}`];

	if (options.includeWikilinks) {
		lines.push(`**Series:** ${makeWikilink(seriesName)}`);
	}

	lines.push(`**Library:** ${libraryName}`);

	return lines;
};

/**
 * Convert annotations to a markdown document.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const toMarkdown = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	options: FormatOptions,
	metadataMap?: SeriesMetadataMap,
	chapterInfoMap?: ChapterInfoMap,
): string => {
	const frontmatter = generateFrontmatter(options);

	if (annotations.length === 0) {
		return `${frontmatter}\n\n# Kavita Annotations\n\n*No annotations found.*\n`;
	}

	const seriesGroups = groupBySeriesId(annotations);

	const content = pipe(
		Record.toEntries(seriesGroups),
		Array.flatMap(([seriesId, seriesAnnotations]) => {
			const firstAnnotation = seriesAnnotations[0];
			if (!firstAnnotation) return [];

			const metadata = metadataMap?.get(Number(seriesId));
			const sortedBookGroups = getSortedBookGroups(
				seriesAnnotations,
				chapterInfoMap,
			);

			return [
				...generateSeriesHeader(firstAnnotation, options, metadata),
				"",
				...pipe(
					sortedBookGroups,
					Array.flatMap(([bookTitle, bookAnnotations]) => {
						const chapterGroups = groupByChapterId(bookAnnotations);
						const bookAuthors = getBookAuthors(bookAnnotations, chapterInfoMap);
						const bookGenres = getBookGenres(bookAnnotations, chapterInfoMap);

						return [
							...generateBookHeader(
								bookTitle,
								options,
								bookAuthors,
								bookGenres,
							),
							"",
							...pipe(
								Record.toEntries(chapterGroups),
								Array.flatMap(([_chapterId, chapterAnnotations]) => {
									const firstChapterAnnotation = chapterAnnotations[0];
									const chapterTitle = firstChapterAnnotation
										? getChapterTitle(firstChapterAnnotation)
										: "Unknown Chapter";

									return [
										`#### Chapter: ${chapterTitle}`,
										"",
										...pipe(
											chapterAnnotations,
											Array.filterMap((a) => formatAnnotation(a, options)),
											Array.flatMap((formatted) => [formatted, "", "---", ""]),
										),
									];
								}),
							),
						];
					}),
				),
			];
		}),
	);

	return [frontmatter, "", "# Kavita Annotations", "", ...content].join("\n");
};
