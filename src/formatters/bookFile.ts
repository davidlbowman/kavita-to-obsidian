/**
 * Book file formatter for hierarchical folder structure.
 *
 * Generates markdown files for individual books with rich frontmatter
 * and wikilinks for Obsidian integration.
 *
 * @module
 */
import { Array, Option, pipe } from "effect";
import type { AnnotationDto } from "../schemas.js";
import type { FormatOptions } from "./markdown.js";
import { getCommentText, toSlug } from "./markdown.js";

/**
 * Options for formatting a book file.
 *
 * @since 1.1.0
 * @category Book File
 */
export interface BookFileOptions {
	readonly bookTitle: string;
	readonly seriesName: string;
	readonly seriesId: number;
	readonly chapterId: number;
	readonly authors: ReadonlyArray<string>;
	readonly genres: ReadonlyArray<string>;
	readonly annotations: ReadonlyArray<typeof AnnotationDto.Type>;
	readonly formatOptions: FormatOptions;
}

/**
 * Generate YAML frontmatter for a book file.
 *
 * @since 1.1.0
 * @category Book File
 */
export const generateBookFrontmatter = (options: BookFileOptions): string => {
	const lines: string[] = ["---"];

	const tags: string[] = ["kavita"];

	const seriesSlug = toSlug(options.seriesName);
	if (seriesSlug) {
		tags.push(`series/${seriesSlug}`);
	}

	for (const author of options.authors) {
		const authorSlug = toSlug(author);
		if (authorSlug) {
			tags.push(`author/${authorSlug}`);
		}
	}

	for (const genre of options.genres) {
		const genreSlug = toSlug(genre);
		if (genreSlug && options.formatOptions.tagPrefix) {
			tags.push(`${options.formatOptions.tagPrefix}${genreSlug}`);
		} else if (genreSlug) {
			tags.push(`genre/${genreSlug}`);
		}
	}

	if (tags.length > 0) {
		lines.push("tags:");
		for (const tag of tags) {
			lines.push(`  - ${tag}`);
		}
	}

	lines.push(`kavita_series_id: ${options.seriesId}`);
	lines.push(`kavita_chapter_id: ${options.chapterId}`);
	lines.push(`updated: ${new Date().toISOString()}`);
	lines.push("---");

	return lines.join("\n");
};

/**
 * Generate the header section with metadata and wikilinks.
 *
 * @since 1.1.0
 * @category Book File
 */
export const generateBookHeader = (options: BookFileOptions): string => {
	const lines: string[] = [`# ${options.bookTitle}`, ""];

	if (options.formatOptions.includeWikilinks) {
		lines.push(`**Series:** [[${options.seriesName}]]`);
	} else {
		lines.push(`**Series:** ${options.seriesName}`);
	}

	if (options.authors.length > 0) {
		if (options.formatOptions.includeWikilinks) {
			const authorLinks = options.authors.map((a) => `[[${a}]]`).join(", ");
			lines.push(`**Author:** ${authorLinks}`);
		} else {
			lines.push(`**Author:** ${options.authors.join(", ")}`);
		}
	}

	if (options.genres.length > 0) {
		lines.push(`**Genres:** ${options.genres.join(", ")}`);
	}

	lines.push("");
	lines.push("---");
	lines.push("");

	return lines.join("\n");
};

/**
 * Format a single annotation for a book file.
 *
 * @since 1.1.0
 * @category Book File
 */
export const formatBookAnnotation = (
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
 * Generate the annotations section of a book file.
 *
 * @since 1.1.0
 * @category Book File
 */
export const generateAnnotationsSection = (
	annotations: ReadonlyArray<typeof AnnotationDto.Type>,
	options: FormatOptions,
): string => {
	const lines: string[] = ["## Annotations", ""];

	if (annotations.length === 0) {
		lines.push("*No annotations yet.*");
		return lines.join("\n");
	}

	const formattedAnnotations = pipe(
		annotations,
		Array.filterMap((a) => formatBookAnnotation(a, options)),
		Array.flatMap((formatted) => [formatted, "", "---", ""]),
	);

	lines.push(...formattedAnnotations);

	return lines.join("\n");
};

/**
 * Format a complete book file with frontmatter, header, and annotations.
 *
 * @since 1.1.0
 * @category Book File
 */
export const formatBookFile = (options: BookFileOptions): string => {
	const frontmatter = generateBookFrontmatter(options);
	const header = generateBookHeader(options);
	const annotations = generateAnnotationsSection(
		options.annotations,
		options.formatOptions,
	);

	return [frontmatter, "", header, annotations].join("\n");
};
