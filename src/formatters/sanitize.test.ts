/**
 * Tests for text sanitization functions.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
	decodeHtmlEntities,
	extractTextFromQuillDelta,
	resolveComment,
	stripHtmlTags,
} from "./sanitize.js";

const NoAmpersand = Schema.String.pipe(
	Schema.check(Schema.makeFilter((s: string) => !s.includes("&"))),
);

const NoAngleBrackets = Schema.String.pipe(
	Schema.check(Schema.makeFilter((s: string) => !/[<>]/.test(s))),
);

describe("decodeHtmlEntities", () => {
	it("decodes XML named entities", () => {
		expect(decodeHtmlEntities("&amp;&lt;&gt;&quot;&apos;")).toBe(`&<>"'`);
	});

	it("decodes typographic named entities", () => {
		expect(
			decodeHtmlEntities(
				"&nbsp;&mdash;&ndash;&hellip;&rsquo;&lsquo;&rdquo;&ldquo;",
			),
		).toBe(" —–…’‘”“");
	});

	it("decodes decimal and hex entities", () => {
		expect(decodeHtmlEntities("&#39;&#123;")).toBe("'{");
		expect(decodeHtmlEntities("&#x27;&#x7B;&#x7b;")).toBe("'{{");
	});

	it("leaves unknown named entities alone", () => {
		expect(decodeHtmlEntities("&bogus; &copy;")).toBe("&bogus; &copy;");
	});

	it("decodes mixed content", () => {
		expect(decodeHtmlEntities("It&#39;s a &quot;test&quot; &amp; more")).toBe(
			`It's a "test" & more`,
		);
	});

	it.prop("is the identity on text without '&'", [NoAmpersand], ([text]) => {
		expect(decodeHtmlEntities(text)).toBe(text);
	});
});

describe("stripHtmlTags", () => {
	it("removes paired and self-closing tags", () => {
		expect(stripHtmlTags("<p>Hello <em>world</em></p><br/><br />!")).toBe(
			"Hello world!",
		);
	});

	it("keeps tags' attributes out of the text", () => {
		expect(stripHtmlTags('<a href="x">link</a>')).toBe("link");
	});

	it.prop(
		"is the identity on text without angle brackets",
		[NoAngleBrackets],
		([text]) => {
			expect(stripHtmlTags(text)).toBe(text);
		},
	);
});

describe("extractTextFromQuillDelta", () => {
	it("concatenates string inserts and trims trailing newlines", () => {
		expect(
			extractTextFromQuillDelta(
				JSON.stringify({
					ops: [{ insert: "Hello " }, { insert: "world\n\n" }],
				}),
			),
		).toBe("Hello world");
	});

	it("skips non-string inserts and ops without insert", () => {
		expect(
			extractTextFromQuillDelta(
				JSON.stringify({
					ops: [
						{ insert: "A" },
						{ insert: { image: "x.png" } },
						{ retain: 3 },
						{ insert: "B" },
					],
				}),
			),
		).toBe("AB");
	});

	it("returns invalid JSON unchanged", () => {
		expect(extractTextFromQuillDelta("not json {")).toBe("not json {");
	});

	it("returns JSON that is not a delta unchanged", () => {
		expect(extractTextFromQuillDelta('{"foo":1}')).toBe('{"foo":1}');
		expect(extractTextFromQuillDelta('{"ops":"nope"}')).toBe('{"ops":"nope"}');
		expect(extractTextFromQuillDelta("42")).toBe("42");
	});
});

describe("resolveComment", () => {
	it("prefers trimmed plain text", () => {
		expect(
			resolveComment({
				comment: "raw",
				commentHtml: "<p>html</p>",
				commentPlainText: "  plain  ",
			}),
		).toBe("plain");
	});

	it("skips empty or '{}' plain text and falls back to stripped, decoded HTML", () => {
		expect(
			resolveComment({
				comment: "raw",
				commentHtml: "<p>Tom &amp; Jerry</p>",
				commentPlainText: "{}",
			}),
		).toBe("Tom & Jerry");
		expect(
			resolveComment({
				comment: "raw",
				commentHtml: "<b>bold</b>",
				commentPlainText: "   ",
			}),
		).toBe("bold");
	});

	it("falls back to the raw comment when HTML has no text", () => {
		expect(
			resolveComment({
				comment: "It&#39;s raw",
				commentHtml: "<p></p>",
				commentPlainText: null,
			}),
		).toBe("It's raw");
		expect(
			resolveComment({
				comment: "raw",
				commentHtml: "   ",
				commentPlainText: null,
			}),
		).toBe("raw");
	});

	it("extracts Quill delta comments", () => {
		expect(
			resolveComment({
				comment: JSON.stringify({ ops: [{ insert: "From delta\n" }] }),
				commentHtml: null,
				commentPlainText: null,
			}),
		).toBe("From delta");
	});

	it("returns null when nothing usable remains", () => {
		expect(
			resolveComment({
				comment: null,
				commentHtml: null,
				commentPlainText: null,
			}),
		).toBeNull();
		expect(
			resolveComment({ comment: "{}", commentHtml: "", commentPlainText: "" }),
		).toBeNull();
		expect(
			resolveComment({
				comment: "  ",
				commentHtml: null,
				commentPlainText: null,
			}),
		).toBeNull();
		expect(
			resolveComment({
				comment: JSON.stringify({ ops: [{ insert: "\n" }] }),
				commentHtml: null,
				commentPlainText: null,
			}),
		).toBeNull();
	});
});
