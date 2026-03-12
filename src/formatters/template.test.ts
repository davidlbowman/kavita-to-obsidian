/**
 * Tests for template engine.
 *
 * @module
 */

import { describe, expect, it, vi } from "vitest";
import {
	DEFAULT_ANNOTATION_TEMPLATE,
	renderTemplate,
	validateTemplate,
} from "./template.js";

describe("renderTemplate", () => {
	describe("interpolation", () => {
		it("replaces a single variable", () => {
			const result = renderTemplate("Hello {{name}}", { name: "World" });
			expect(result).toBe("Hello World");
		});

		it("replaces multiple variables in one template", () => {
			const result = renderTemplate("{{greeting}} {{name}}!", {
				greeting: "Hello",
				name: "World",
			});
			expect(result).toBe("Hello World!");
		});

		it("replaces missing variable with empty string", () => {
			const result = renderTemplate("Hello {{name}}", {});
			expect(result).toBe("Hello ");
		});

		it("converts numbers to strings", () => {
			const result = renderTemplate("Page {{num}}", { num: 42 });
			expect(result).toBe("Page 42");
		});
	});

	describe("conditionals", () => {
		it("includes content when variable is truthy", () => {
			const result = renderTemplate("{{#if name}}Hello {{name}}{{/if}}", {
				name: "World",
			});
			expect(result).toBe("Hello World");
		});

		it("excludes content when variable is empty string", () => {
			const result = renderTemplate("{{#if name}}Hello {{name}}{{/if}}", {
				name: "",
			});
			expect(result).toBe("");
		});

		it("excludes content when variable is 0 (falsy)", () => {
			const result = renderTemplate("{{#if count}}Count: {{count}}{{/if}}", {
				count: 0,
			});
			expect(result).toBe("");
		});

		it("excludes content when variable is missing", () => {
			const result = renderTemplate("{{#if name}}Hello {{name}}{{/if}}", {});
			expect(result).toBe("");
		});

		it("handles nested conditionals", () => {
			const template = "{{#if a}}A{{#if b}}B{{/if}}{{/if}}";
			expect(renderTemplate(template, { a: "yes", b: "yes" })).toBe("AB");
			expect(renderTemplate(template, { a: "yes", b: "" })).toBe("A");
			expect(renderTemplate(template, { a: "", b: "yes" })).toBe("");
		});
	});

	describe("malformed templates", () => {
		it("returns empty string for unclosed if", () => {
			const result = renderTemplate("{{#if name}}Hello", { name: "World" });

			expect(result).toBe("");
		});
	});

	describe("edge cases", () => {
		it("returns empty string for empty template", () => {
			const result = renderTemplate("", {});
			expect(result).toBe("");
		});

		it("replaces all variables with empty strings when context is empty", () => {
			const result = renderTemplate("{{a}} and {{b}}", {});
			expect(result).toBe(" and ");
		});
	});

	describe("DEFAULT_ANNOTATION_TEMPLATE", () => {
		it("renders full context with blockquote, comment, and page", () => {
			const result = renderTemplate(DEFAULT_ANNOTATION_TEMPLATE, {
				selectedText: "This is highlighted text",
				blockquote: "> This is highlighted text",
				comment: "My note",
				pageNumber: 42,
			});

			expect(result).toBe(
				"> This is highlighted text\n\n*Note:* My note\n\n<small>Page 42</small>",
			);
		});

		it("renders without comment when comment is empty", () => {
			const result = renderTemplate(DEFAULT_ANNOTATION_TEMPLATE, {
				selectedText: "This is highlighted text",
				blockquote: "> This is highlighted text",
				comment: "",
				pageNumber: 42,
			});

			expect(result).toBe(
				"> This is highlighted text\n\n<small>Page 42</small>",
			);
		});

		it("renders without pageNumber when pageNumber is missing", () => {
			const result = renderTemplate(DEFAULT_ANNOTATION_TEMPLATE, {
				selectedText: "This is highlighted text",
				blockquote: "> This is highlighted text",
				comment: "My note",
			});

			expect(result).toBe("> This is highlighted text\n\n*Note:* My note");
		});

		it("renders multi-line text as proper blockquote", () => {
			const result = renderTemplate(DEFAULT_ANNOTATION_TEMPLATE, {
				selectedText: "Line one\nLine two\nLine three",
				blockquote: "> Line one\n> Line two\n> Line three",
				comment: "",
				pageNumber: 0,
			});

			expect(result).toBe("> Line one\n> Line two\n> Line three");
		});
	});
});

describe("validateTemplate", () => {
	it("returns valid for correct template", () => {
		const result = validateTemplate("{{#if name}}Hello{{/if}}");
		expect(result).toEqual({ valid: true });
	});

	it("returns valid for template with no blocks", () => {
		const result = validateTemplate("Hello {{name}}");
		expect(result).toEqual({ valid: true });
	});

	it("returns invalid for unclosed if", () => {
		const result = validateTemplate("{{#if name}}Hello");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("Unclosed");
	});

	it("returns invalid for extra closing tag", () => {
		const result = validateTemplate("Hello{{/if}}");
		expect(result.valid).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error).toContain("{{/if}}");
	});

	it("returns valid for nested blocks", () => {
		const result = validateTemplate("{{#if a}}{{#if b}}inner{{/if}}{{/if}}");
		expect(result).toEqual({ valid: true });
	});
});
