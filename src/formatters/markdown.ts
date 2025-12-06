/**
 * Pure formatting functions for converting annotations to markdown.
 *
 * @module
 */
import { Option } from "effect";
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
	if (annotation.spoiler && !options.includeSpoilers) {
		return Option.none();
	}

	const lines: string[] = [];

	lines.push(`> ${annotation.content}`);

	if (options.includeComments && annotation.comment) {
		lines.push("");
		lines.push(`*Note:* ${annotation.comment}`);
	}

	if (annotation.page !== undefined) {
		lines.push("");
		lines.push(`<small>Page ${annotation.page}</small>`);
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
): Map<number | undefined, Array<typeof AnnotationDto.Type>> => {
	const groups = new Map<
		number | undefined,
		Array<typeof AnnotationDto.Type>
	>();

	for (const annotation of annotations) {
		const key = annotation.seriesId;
		const existing = groups.get(key) ?? [];
		existing.push(annotation);
		groups.set(key, existing);
	}

	return groups;
};

/**
 * Group annotations by chapterId.
 *
 * @since 0.0.1
 * @category Formatters
 */
export const groupByChapterId = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
): Map<number, Array<typeof AnnotationDto.Type>> => {
	const groups = new Map<number, Array<typeof AnnotationDto.Type>>();

	for (const annotation of annotations) {
		const key = annotation.chapterId;
		const existing = groups.get(key) ?? [];
		existing.push(annotation);
		groups.set(key, existing);
	}

	return groups;
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
	if (annotations.length === 0) {
		return "# Kavita Annotations\n\n*No annotations found.*\n";
	}

	const lines: string[] = ["# Kavita Annotations", ""];

	const seriesGroups = groupBySeriesId(annotations);

	for (const [seriesId, seriesAnnotations] of seriesGroups) {
		const seriesTitle =
			seriesId !== undefined ? `Series ${seriesId}` : "Ungrouped";
		lines.push(`## ${seriesTitle}`, "");

		const chapterGroups = groupByChapterId(seriesAnnotations);

		for (const [chapterId, chapterAnnotations] of chapterGroups) {
			lines.push(`### Chapter ${chapterId}`, "");

			for (const annotation of chapterAnnotations) {
				const formatted = formatAnnotation(annotation, options);
				if (Option.isSome(formatted)) {
					lines.push(formatted.value, "", "---", "");
				}
			}
		}
	}

	return lines.join("\n");
};
