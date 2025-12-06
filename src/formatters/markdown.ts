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
}

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

	// Use selectedText as the main content (the highlighted text)
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
 * Convert annotations to a markdown document.
 *
 * @since 0.0.1
 * @category Formatters
 */
export const toMarkdown = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	options: FormatOptions,
): string => {
	if (annotations.length === 0) {
		return "# Kavita Annotations\n\n*No annotations found.*\n";
	}

	const seriesGroups = groupBySeriesId(annotations);

	const content = pipe(
		Record.toEntries(seriesGroups),
		Array.flatMap(([seriesId, seriesAnnotations]) => {
			const seriesTitle =
				seriesId !== "undefined" ? `Series ${seriesId}` : "Ungrouped";
			const chapterGroups = groupByChapterId(seriesAnnotations);

			return [
				`## ${seriesTitle}`,
				"",
				...pipe(
					Record.toEntries(chapterGroups),
					Array.flatMap(([chapterId, chapterAnnotations]) => [
						`### Chapter ${chapterId}`,
						"",
						...pipe(
							chapterAnnotations,
							Array.filterMap((a) => formatAnnotation(a, options)),
							Array.flatMap((formatted) => [formatted, "", "---", ""]),
						),
					]),
				),
			];
		}),
	);

	return ["# Kavita Annotations", "", ...content].join("\n");
};
