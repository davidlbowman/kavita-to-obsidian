/**
 * Tests for text sanitization functions.
 *
 * @module
 */
import { describe, expect, it } from "vitest";
import {
	decodeHtmlEntities,
	extractTextFromQuillDelta,
	resolveComment,
	stripHtmlTags,
} from "./sanitize.js";

describe("decodeHtmlEntities", () => {
	it("decodes XML-5 named entities", () => {
		expect(decodeHtmlEntities("&amp;")).toBe("&");
		expect(decodeHtmlEntities("&lt;")).toBe("<");
		expect(decodeHtmlEntities("&gt;")).toBe(">");
		expect(decodeHtmlEntities("&quot;")).toBe('"');
		expect(decodeHtmlEntities("&apos;")).toBe("'");
	});

	it("decodes typographic named entities", () => {
		expect(decodeHtmlEntities("&nbsp;")).toBe(" ");
		expect(decodeHtmlEntities("&mdash;")).toBe("—");
		expect(decodeHtmlEntities("&ndash;")).toBe("–");
		expect(decodeHtmlEntities("&hellip;")).toBe("…");
		expect(decodeHtmlEntities("&rsquo;")).toBe("\u2019");
		expect(decodeHtmlEntities("&lsquo;")).toBe("\u2018");
		expect(decodeHtmlEntities("&rdquo;")).toBe("\u201D");
		expect(decodeHtmlEntities("&ldquo;")).toBe("\u201C");
	});

	it("decodes numeric entities", () => {
		expect(decodeHtmlEntities("&#39;")).toBe("'");
		expect(decodeHtmlEntities("&#123;")).toBe("{");
		expect(decodeHtmlEntities("&#125;")).toBe("}");
	});

	it("decodes hex entities", () => {
		expect(decodeHtmlEntities("&#x27;")).toBe("'");
		expect(decodeHtmlEntities("&#x7B;")).toBe("{");
		expect(decodeHtmlEntities("&#x7b;")).toBe("{");
	});

	it("decodes mixed content", () => {
		expect(decodeHtmlEntities("It&#39;s a &quot;test&quot; &amp; more")).toBe(
			'It\'s a "test" & more',
		);
	});

	it("passes through text with no entities", () => {
		expect(decodeHtmlEntities("Hello world")).toBe("Hello world");
	});

	it("returns empty string for empty input", () => {
		expect(decodeHtmlEntities("")).toBe("");
	});
});

describe("stripHtmlTags", () => {
	it("strips emphasis tags", () => {
		expect(stripHtmlTags("<em>text</em>")).toBe("text");
	});

	it("strips paragraph tags", () => {
		expect(stripHtmlTags("<p>text</p>")).toBe("text");
	});

	it("strips self-closing br tags", () => {
		expect(stripHtmlTags("line1<br/>line2")).toBe("line1line2");
		expect(stripHtmlTags("line1<br />line2")).toBe("line1line2");
	});

	it("strips tags with attributes", () => {
		expect(stripHtmlTags('<span class="highlight">text</span>')).toBe("text");
	});

	it("strips nested tags", () => {
		expect(stripHtmlTags("<p><strong>bold</strong> text</p>")).toBe(
			"bold text",
		);
	});

	it("passes through text with no tags", () => {
		expect(stripHtmlTags("Hello world")).toBe("Hello world");
	});

	it("returns empty string for empty input", () => {
		expect(stripHtmlTags("")).toBe("");
	});
});

describe("extractTextFromQuillDelta", () => {
	it("extracts text from a single insert", () => {
		const delta = JSON.stringify({ ops: [{ insert: "Hello world\n" }] });
		expect(extractTextFromQuillDelta(delta)).toBe("Hello world");
	});

	it("extracts text from multiple inserts", () => {
		const delta = JSON.stringify({
			ops: [{ insert: "Hello " }, { insert: "world\n" }],
		});
		expect(extractTextFromQuillDelta(delta)).toBe("Hello world");
	});

	it("extracts text from inserts with attributes", () => {
		const delta = JSON.stringify({
			ops: [{ insert: "bold text", attributes: { bold: true } }],
		});
		expect(extractTextFromQuillDelta(delta)).toBe("bold text");
	});

	it("skips non-string inserts like images", () => {
		const delta = JSON.stringify({
			ops: [
				{ insert: "before " },
				{ insert: { image: "http://example.com/img.png" } },
				{ insert: " after\n" },
			],
		});
		expect(extractTextFromQuillDelta(delta)).toBe("before  after");
	});

	it("trims trailing newlines", () => {
		const delta = JSON.stringify({
			ops: [{ insert: "text\n\n\n" }],
		});
		expect(extractTextFromQuillDelta(delta)).toBe("text");
	});

	it("returns original string for non-JSON input", () => {
		expect(extractTextFromQuillDelta("just plain text")).toBe(
			"just plain text",
		);
	});

	it("returns original string for malformed JSON", () => {
		expect(extractTextFromQuillDelta("{bad json")).toBe("{bad json");
	});

	it("returns original string for non-Quill object", () => {
		expect(extractTextFromQuillDelta('{"key": "value"}')).toBe(
			'{"key": "value"}',
		);
	});

	it("returns original string for plain string value", () => {
		expect(extractTextFromQuillDelta("Hello world")).toBe("Hello world");
	});
});

describe("resolveComment", () => {
	it("prefers commentPlainText when available", () => {
		const result = resolveComment({
			comment: '{"ops":[{"insert":"quill\\n"}]}',
			commentHtml: "<p>html</p>",
			commentPlainText: "plain text",
		});
		expect(result).toBe("plain text");
	});

	it("falls back to commentHtml when commentPlainText is null", () => {
		const result = resolveComment({
			comment: null,
			commentHtml: "<p>html content</p>",
			commentPlainText: null,
		});
		expect(result).toBe("html content");
	});

	it("strips tags and decodes entities from commentHtml", () => {
		const result = resolveComment({
			comment: null,
			commentHtml: "<p>It&#39;s &amp; <em>formatted</em></p>",
			commentPlainText: null,
		});
		expect(result).toBe("It's & formatted");
	});

	it("falls back to comment and extracts Quill delta", () => {
		const result = resolveComment({
			comment: '{"ops":[{"insert":"quill text\\n"}]}',
			commentHtml: null,
			commentPlainText: null,
		});
		expect(result).toBe("quill text");
	});

	it("decodes entities in comment after Quill extraction", () => {
		const result = resolveComment({
			comment: '{"ops":[{"insert":"it&#39;s here\\n"}]}',
			commentHtml: null,
			commentPlainText: null,
		});
		expect(result).toBe("it's here");
	});

	it("returns null when all fields are null", () => {
		const result = resolveComment({
			comment: null,
			commentHtml: null,
			commentPlainText: null,
		});
		expect(result).toBeNull();
	});

	it("returns null when all fields are empty strings", () => {
		const result = resolveComment({
			comment: "",
			commentHtml: "",
			commentPlainText: "",
		});
		expect(result).toBeNull();
	});

	it('returns null when comment is "{}" with null others', () => {
		const result = resolveComment({
			comment: "{}",
			commentHtml: null,
			commentPlainText: null,
		});
		expect(result).toBeNull();
	});

	it("handles whitespace-only values", () => {
		const result = resolveComment({
			comment: "   ",
			commentHtml: "   ",
			commentPlainText: "   ",
		});
		expect(result).toBeNull();
	});

	it('skips commentPlainText when it is "{}"', () => {
		const result = resolveComment({
			comment: null,
			commentHtml: "<p>fallback</p>",
			commentPlainText: "{}",
		});
		expect(result).toBe("fallback");
	});
});
