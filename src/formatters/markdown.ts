/**
 * Pure formatting functions for converting annotations to markdown.
 *
 * @module
 */
import { Array, Option, pipe, Record } from "effect";
import type { AnnotationDto } from "../schemas.js";

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
 * Generate a prefixed tag.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const makeTag = (
	prefix: string,
	category: string,
	value: string,
): string => `#${prefix}${category}/${toSlug(value)}`;

/**
 * Generate a wikilink.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const makeWikilink = (value: string): string => `[[${value}]]`;

/**
 * Format a single annotation to markdown.
 *
 * @since 0.0.1
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
	lines.push(`> ${content}`);

	if (options.includeComments && annotation.comment) {
		lines.push("");
		lines.push(`*Note:* ${annotation.comment}`);
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
 * Generate YAML frontmatter for the annotations document.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const generateFrontmatter = (options: FormatOptions): string => {
	const lines = ["---", "title: Kavita Annotations"];

	if (options.includeTags) {
		lines.push("tags:");
		lines.push(`  - ${options.tagPrefix.replace(/\/$/, "")}`);
		lines.push("  - annotations");
	}

	lines.push(`updated: ${new Date().toISOString()}`);
	lines.push("---");

	return lines.join("\n");
};

/**
 * Generate series header with metadata.
 *
 * @since 0.0.2
 * @category Formatters
 */
export const generateSeriesHeader = (
	firstAnnotation: typeof AnnotationDto.Type,
	options: FormatOptions,
): string[] => {
	const seriesName = getSeriesName(firstAnnotation);
	const libraryName = getLibraryName(firstAnnotation);

	const lines: string[] = [`## ${seriesName}`];

	if (options.includeWikilinks) {
		lines.push(`**Series:** ${makeWikilink(seriesName)}`);
	}

	lines.push(`**Library:** ${libraryName}`);

	if (options.includeTags) {
		const tags: string[] = [
			makeTag(options.tagPrefix, "series", seriesName),
			makeTag(options.tagPrefix, "library", libraryName),
		];
		lines.push(`**Tags:** ${tags.join(" ")}`);
	}

	return lines;
};

/**
 * Convert annotations to a markdown document.
 *
 * @since 0.0.1
 * @category Formatters
 */
export const toMarkdown = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	options: FormatOptions,
): string => {
	const frontmatter = generateFrontmatter(options);

	if (annotations.length === 0) {
		return `${frontmatter}\n\n# Kavita Annotations\n\n*No annotations found.*\n`;
	}

	const seriesGroups = groupBySeriesId(annotations);

	const content = pipe(
		Record.toEntries(seriesGroups),
		Array.flatMap(([_seriesId, seriesAnnotations]) => {
			const firstAnnotation = seriesAnnotations[0];
			if (!firstAnnotation) return [];

			const chapterGroups = groupByChapterId(seriesAnnotations);

			return [
				...generateSeriesHeader(firstAnnotation, options),
				"",
				...pipe(
					Record.toEntries(chapterGroups),
					Array.flatMap(([_chapterId, chapterAnnotations]) => {
						const firstChapterAnnotation = chapterAnnotations[0];
						const chapterTitle = firstChapterAnnotation
							? getChapterTitle(firstChapterAnnotation)
							: "Unknown Chapter";

						return [
							`### ${chapterTitle}`,
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
	);

	return [frontmatter, "", "# Kavita Annotations", "", ...content].join("\n");
};
