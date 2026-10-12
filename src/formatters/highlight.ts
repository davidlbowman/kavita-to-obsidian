/**
 * Render individual highlights and group them into chapters.
 *
 * @module
 */
import { Array as Arr, Option, Order, pipe } from "effect";
import {
	type Annotation,
	DEFAULT_ANNOTATION_TEMPLATE,
	type FormatOptions,
	type HighlightColor,
} from "../schemas.js";
import { annotationUrl } from "./links.js";
import { decodeHtmlEntities, resolveComment } from "./sanitize.js";
import { renderTemplate } from "./template.js";

const COLORS: ReadonlyArray<HighlightColor> = [
	"cyan",
	"green",
	"yellow",
	"orange",
	"magenta",
];

/**
 * The Kavita highlight color for a highlight slot.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const highlightColor = (slot: number): HighlightColor =>
	COLORS[((slot % COLORS.length) + COLORS.length) % COLORS.length] ?? "yellow";

/**
 * Block id that links to a highlight, stable across syncs.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const blockId = (annotation: Pick<Annotation, "id">): string =>
	`kavita-${annotation.id}`;

const quoteLines = (text: string): string =>
	text
		.split("\n")
		.map((line) => (line === "" ? ">" : `> ${line}`))
		.join("\n");

/**
 * Everything a highlight template can reference.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const highlightVariables = (
	annotation: Annotation,
	options: FormatOptions,
	kavitaUrl: URL,
): Record<string, string | number> => {
	const text = decodeHtmlEntities(annotation.selectedText ?? "").trim();
	const comment = options.includeComments
		? (resolveComment(annotation) ?? "")
		: "";
	const page = annotation.pageNumber > 0 ? annotation.pageNumber : 0;
	const place = page > 0 ? `Page ${page}` : "Highlight";
	return {
		quote: quoteLines(text),
		blockquote: quoteLines(text),
		selectedText: text,
		comment,
		commentQuote: comment.split("\n").join("\n> "),
		callout: options.highlightColors
			? `kavita-${highlightColor(annotation.selectedSlotIndex)}`
			: "quote",
		color: highlightColor(annotation.selectedSlotIndex),
		fold: annotation.containsSpoiler ? "-" : "",
		location: annotation.containsSpoiler ? `Spoiler · ${place}` : place,
		link: annotationUrl(kavitaUrl, annotation),
		pageNumber: page,
		chapterTitle: annotation.chapterTitle ?? "",
		seriesName: annotation.seriesName ?? "",
		date: annotation.createdUtc.slice(0, 10),
		createdUtc: annotation.createdUtc,
	};
};

/**
 * The template variables, with a short description of each, for the editor.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const TEMPLATE_VARIABLES: ReadonlyArray<readonly [string, string]> = [
	["quote", "Highlighted text as quote lines"],
	["selectedText", "Highlighted text, unformatted"],
	["comment", "Your comment in Kavita"],
	["commentQuote", "Your comment, continued inside a quote"],
	["callout", "Callout type matching the highlight color"],
	["color", "Highlight color name"],
	["fold", "Collapses spoilers"],
	["location", "Page label, e.g. Page 12"],
	["link", "Opens this highlight in Kavita"],
	["pageNumber", "Page number"],
	["chapterTitle", "Chapter title"],
	["seriesName", "Series name"],
	["date", "Date highlighted"],
];

/**
 * Render one highlight with the configured template, followed by its block
 * id. `None` for hidden spoilers and highlights that render to nothing.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const renderHighlight = (
	annotation: Annotation,
	options: FormatOptions,
	kavitaUrl: URL,
): Option.Option<string> => {
	if (annotation.containsSpoiler && !options.includeSpoilers) {
		return Option.none();
	}
	const rendered = renderTemplate(
		options.annotationTemplate || DEFAULT_ANNOTATION_TEMPLATE,
		highlightVariables(annotation, options, kavitaUrl),
	);
	return rendered === ""
		? Option.none()
		: Option.some(`${rendered}\n\n^${blockId(annotation)}`);
};

/**
 * Reading order: page, then when the highlight was made.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const readingOrder: Order.Order<Annotation> = Order.combine(
	Order.mapInput(Order.Number, (a: Annotation) => a.pageNumber),
	Order.mapInput(Order.String, (a: Annotation) => a.createdUtc),
);

/**
 * A chapter heading and its highlights, in reading order.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const chapters = (
	annotations: ReadonlyArray<Annotation>,
): Array<readonly [string, Arr.NonEmptyArray<Annotation>]> => {
	const groups: Array<[string, Arr.NonEmptyArray<Annotation>]> = [];
	for (const annotation of pipe(annotations, Arr.sort(readingOrder))) {
		const title = annotation.chapterTitle?.trim() || "Highlights";
		const last = groups.at(-1);
		if (last !== undefined && last[0] === title) {
			last[1].push(annotation);
		} else {
			groups.push([title, [annotation]]);
		}
	}
	return groups;
};

/**
 * Render a book's highlights as chapter sections with the given heading level.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const renderChapters = (
	annotations: ReadonlyArray<Annotation>,
	options: FormatOptions,
	kavitaUrl: URL,
	headingLevel: number,
): string => {
	const sections = chapters(annotations).flatMap(([title, group]) => {
		const rendered = Arr.getSomes(
			group.map((a) => renderHighlight(a, options, kavitaUrl)),
		);
		return rendered.length === 0
			? []
			: [`${"#".repeat(headingLevel)} ${title}\n\n${rendered.join("\n\n")}`];
	});
	return sections.length === 0
		? "*No highlights to show yet.*"
		: sections.join("\n\n");
};

/**
 * How many of these highlights a note will show.
 *
 * @since 2.0.0
 * @category Highlights
 */
export const visibleCount = (
	annotations: ReadonlyArray<Annotation>,
	options: FormatOptions,
): number =>
	annotations.filter((a) => options.includeSpoilers || !a.containsSpoiler)
		.length;
