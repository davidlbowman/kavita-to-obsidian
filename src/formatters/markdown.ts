/**
 * Pure functions that render annotations as a single markdown document.
 *
 * @module
 */
import {
	Array as Arr,
	Number as Num,
	Order,
	pipe,
	Record,
	Result,
} from "effect";
import {
	type Annotation,
	type ChapterInfo,
	DEFAULT_ANNOTATION_TEMPLATE,
	type FormatOptions,
} from "../schemas.js";
import { decodeHtmlEntities, resolveComment } from "./sanitize.js";
import { renderTemplate } from "./template.js";

/**
 * Chapter ID to book-level metadata.
 *
 * @since 0.0.2
 * @category Formatters
 */
export type ChapterInfoMap = ReadonlyMap<number, ChapterInfo>;

/**
 * Convert a string to a lowercase, hyphenated slug for tags.
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
 * Build a `#tag` from a value with an optional prefix.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const makeTag = (value: string, prefix = ""): string =>
	`#${prefix}${toSlug(value)}`;

/**
 * Build a `[[wikilink]]`.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const makeWikilink = (value: string): string => `[[${value}]]`;

/**
 * Render one annotation with the configured template.
 *
 * Fails when the annotation is a hidden spoiler or renders to nothing.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const formatAnnotation = (
	annotation: Annotation,
	options: FormatOptions,
): Result.Result<string, void> => {
	if (annotation.containsSpoiler && !options.includeSpoilers) {
		return Result.failVoid;
	}

	const rawText = decodeHtmlEntities(annotation.selectedText ?? "");
	const blockquote = rawText
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n");
	const comment = options.includeComments ? resolveComment(annotation) : null;

	const rendered = renderTemplate(
		options.annotationTemplate || DEFAULT_ANNOTATION_TEMPLATE,
		{
			selectedText: rawText,
			blockquote,
			comment: comment ?? "",
			pageNumber: annotation.pageNumber > 0 ? annotation.pageNumber : 0,
			chapterTitle: annotation.chapterTitle ?? "",
			seriesName: annotation.seriesName ?? "",
			createdUtc: annotation.createdUtc,
		},
	);

	return rendered === "" ? Result.failVoid : Result.succeed(rendered);
};

/**
 * Series name, falling back to its ID.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getSeriesName = (annotation: Annotation): string =>
	annotation.seriesName ?? `Series ${annotation.seriesId}`;

/**
 * Chapter title, falling back to its ID.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getChapterTitle = (annotation: Annotation): string =>
	annotation.chapterTitle ?? `Chapter ${annotation.chapterId}`;

/**
 * Library name, falling back to its ID.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getLibraryName = (annotation: Annotation): string =>
	annotation.libraryName ?? `Library ${annotation.libraryId}`;

/**
 * Book title from chapter info, falling back to the series name.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getBookTitle = (
	annotation: Annotation,
	chapterInfo: ChapterInfoMap,
): string =>
	chapterInfo.get(annotation.chapterId)?.bookTitle ?? getSeriesName(annotation);

const firstChapterInfo = (
	annotations: ReadonlyArray<Annotation>,
	chapterInfo: ChapterInfoMap,
): ChapterInfo | undefined => {
	const first = annotations[0];
	return first === undefined ? undefined : chapterInfo.get(first.chapterId);
};

const groupBy = (
	annotations: ReadonlyArray<Annotation>,
	key: (annotation: Annotation) => string,
): Array<[string, Arr.NonEmptyArray<Annotation>]> =>
	Record.toEntries(Arr.groupBy(annotations, key));

/**
 * Group a series' annotations by book, ordered by volume number.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const getSortedBookGroups = (
	annotations: ReadonlyArray<Annotation>,
	chapterInfo: ChapterInfoMap,
): Array<[string, Arr.NonEmptyArray<Annotation>]> =>
	pipe(
		groupBy(annotations, (a) => getBookTitle(a, chapterInfo)),
		Arr.sort(
			Order.mapInput(
				Num.Order,
				([, group]: [string, Arr.NonEmptyArray<Annotation>]) =>
					firstChapterInfo(group, chapterInfo)?.sortOrder ?? 0,
			),
		),
	);

/**
 * Heading and metadata lines for a book section.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const generateBookHeader = (
	bookTitle: string,
	options: FormatOptions,
	authors: ReadonlyArray<string>,
	genres: ReadonlyArray<string>,
): Array<string> => {
	const lines = [`### ${bookTitle}`];
	if (authors.length > 0) {
		const names = options.includeWikilinks
			? authors.map(makeWikilink)
			: authors;
		lines.push(`**Author:** ${names.join(", ")}`);
	}
	if (options.includeWikilinks) {
		lines.push(`**Book:** ${makeWikilink(bookTitle)}`);
	}
	if (genres.length > 0) {
		lines.push(`**Genres:** ${genres.join(", ")}`);
		if (options.includeTags) {
			const tags = genres.map((g) => makeTag(g, options.tagPrefix));
			lines.push(`**Tags:** ${tags.join(" ")}`);
		}
	}
	return lines;
};

/**
 * YAML frontmatter for the single-file export.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const generateFrontmatter = (
	options: FormatOptions,
	updated: string,
): string => {
	const lines = ["---", "title: Kavita Annotations"];
	if (options.includeTags) {
		lines.push("tags:", "  - annotations", "  - kavita");
	}
	lines.push(`updated: ${updated}`, "---");
	return lines.join("\n");
};

/**
 * Heading and metadata lines for a series section.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const generateSeriesHeader = (
	firstAnnotation: Annotation,
	options: FormatOptions,
): Array<string> => {
	const seriesName = getSeriesName(firstAnnotation);
	const lines = [`## ${seriesName}`];
	if (options.includeWikilinks) {
		lines.push(`**Series:** ${makeWikilink(seriesName)}`);
	}
	lines.push(`**Library:** ${getLibraryName(firstAnnotation)}`);
	return lines;
};

const renderChapter = (
	annotations: Arr.NonEmptyArray<Annotation>,
	options: FormatOptions,
): Array<string> => [
	`#### Chapter: ${getChapterTitle(annotations[0])}`,
	"",
	...pipe(
		annotations,
		Arr.filterMap((a) => formatAnnotation(a, options)),
		Arr.flatMap((formatted) => [formatted, "", "---", ""]),
	),
];

const renderBook = (
	bookTitle: string,
	annotations: Arr.NonEmptyArray<Annotation>,
	options: FormatOptions,
	chapterInfo: ChapterInfoMap,
): Array<string> => {
	const info = firstChapterInfo(annotations, chapterInfo);
	return [
		...generateBookHeader(
			bookTitle,
			options,
			info?.authors ?? [],
			info?.genres ?? [],
		),
		"",
		...pipe(
			groupBy(annotations, (a) => String(a.chapterId)),
			Arr.flatMap(([, chapter]) => renderChapter(chapter, options)),
		),
	];
};

const renderSeries = (
	annotations: Arr.NonEmptyArray<Annotation>,
	options: FormatOptions,
	chapterInfo: ChapterInfoMap,
): Array<string> => [
	...generateSeriesHeader(annotations[0], options),
	"",
	...pipe(
		getSortedBookGroups(annotations, chapterInfo),
		Arr.flatMap(([title, book]) =>
			renderBook(title, book, options, chapterInfo),
		),
	),
];

/**
 * Render every annotation into one markdown document, grouped by series,
 * book, and chapter.
 *
 * @since 0.0.3
 * @category Formatters
 */
export const toMarkdown = (
	annotations: ReadonlyArray<Annotation>,
	options: FormatOptions,
	chapterInfo: ChapterInfoMap,
	updated: string,
): string => {
	const frontmatter = generateFrontmatter(options, updated);
	if (annotations.length === 0) {
		return `${frontmatter}\n\n# Kavita Annotations\n\n*No annotations found.*\n`;
	}
	const content = pipe(
		groupBy(annotations, (a) => String(a.seriesId)),
		Arr.flatMap(([, series]) => renderSeries(series, options, chapterInfo)),
	);
	return [frontmatter, "", "# Kavita Annotations", "", ...content].join("\n");
};
