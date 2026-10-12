/**
 * Pure text sanitization functions for cleaning annotation content.
 *
 * Handles HTML entity decoding, HTML tag stripping, and Quill delta
 * JSON extraction for Kavita annotation fields.
 *
 * @module
 */
import { Option, Predicate, Schema } from "effect";
import type { Annotation } from "../schemas.js";

/**
 * Lookup map of named HTML entities to their decoded characters.
 *
 * @since 1.2.0
 * @category Sanitize
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	mdash: "\u2014",
	ndash: "\u2013",
	hellip: "\u2026",
	rsquo: "\u2019",
	lsquo: "\u2018",
	rdquo: "\u201D",
	ldquo: "\u201C",
};

/**
 * Decode HTML entities in a string to their character equivalents.
 *
 * Supports named entities (e.g. `&amp;`, `&rsquo;`), numeric decimal
 * entities (e.g. `&#39;`), and hexadecimal entities (e.g. `&#x27;`).
 *
 * @since 1.2.0
 * @category Sanitize
 */
export const decodeHtmlEntities = (text: string): string =>
	text
		.replace(
			/&([a-zA-Z]+);/g,
			(match, name: string) => NAMED_ENTITIES[name] ?? match,
		)
		.replace(/&#(\d+);/g, (_match, digits: string) =>
			String.fromCharCode(Number.parseInt(digits, 10)),
		)
		.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		);

/**
 * Remove all HTML tags from a string, preserving inner text content.
 *
 * Handles both paired tags (e.g. `<em>text</em>`) and self-closing
 * tags (e.g. `<br/>`, `<br />`).
 *
 * @since 1.2.0
 * @category Sanitize
 */
export const stripHtmlTags = (text: string): string =>
	text.replace(/<[^>]*>/g, "");

const QuillDelta = Schema.fromJsonString(
	Schema.Struct({
		ops: Schema.Array(
			Schema.Struct({ insert: Schema.optionalKey(Schema.Unknown) }),
		),
	}),
);

const decodeQuillDelta = Schema.decodeUnknownOption(QuillDelta);

/**
 * Extract plain text from a Quill delta JSON string.
 *
 * If the input is valid JSON with an `ops` array, concatenates all
 * string `insert` values and trims trailing newlines. Non-string
 * inserts (images, embeds) are skipped.
 *
 * Returns the original string unchanged if it is not valid Quill
 * delta JSON.
 *
 * @since 1.2.0
 * @category Sanitize
 */
export const extractTextFromQuillDelta = (text: string): string =>
	Option.match(decodeQuillDelta(text), {
		onNone: () => text,
		onSome: ({ ops }) =>
			ops
				.map((op) => op.insert)
				.filter(Predicate.isString)
				.join("")
				.replace(/\n+$/, ""),
	});

/**
 * The annotation fields `resolveComment` reads.
 *
 * @since 1.2.0
 * @category Sanitize
 */
export type CommentFields = Pick<
	Annotation,
	"comment" | "commentHtml" | "commentPlainText"
>;

/**
 * Resolve the best available comment text from an annotation's comment fields.
 *
 * Uses a fallback chain: `commentPlainText` (preferred), then `commentHtml`
 * (with tags stripped and entities decoded), then `comment` (with Quill delta
 * extraction and entity decoding). Returns `null` if no usable text is found.
 *
 * @since 1.2.0
 * @category Sanitize
 */
export const resolveComment = (annotation: CommentFields): string | null => {
	if (annotation.commentPlainText !== null) {
		const trimmed = annotation.commentPlainText.trim();
		if (trimmed !== "" && trimmed !== "{}") {
			return trimmed;
		}
	}

	if (annotation.commentHtml !== null) {
		const trimmed = annotation.commentHtml.trim();
		if (trimmed !== "") {
			const cleaned = decodeHtmlEntities(stripHtmlTags(trimmed)).trim();
			if (cleaned !== "") {
				return cleaned;
			}
		}
	}

	if (annotation.comment !== null) {
		const trimmed = annotation.comment.trim();
		if (trimmed !== "" && trimmed !== "{}") {
			const extracted = decodeHtmlEntities(
				extractTextFromQuillDelta(trimmed),
			).trim();
			if (extracted !== "") {
				return extracted;
			}
		}
	}

	return null;
};
