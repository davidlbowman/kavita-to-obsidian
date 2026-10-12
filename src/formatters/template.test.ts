/**
 * Tests for the Mustache-like annotation template engine.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";
import { DEFAULT_ANNOTATION_TEMPLATE } from "../schemas.js";
import { renderTemplate, validateTemplate } from "./template.js";

const NoBraces = Schema.String.pipe(
	Schema.check(Schema.makeFilter((s: string) => !/[{}\n]/.test(s))),
);

describe("validateTemplate", () => {
	it("accepts templates with balanced or no blocks", () => {
		expect(Result.isSuccess(validateTemplate("{{a}}"))).toBe(true);
		expect(
			Result.isSuccess(validateTemplate("{{#if a}}x{{#if b}}y{{/if}}{{/if}}")),
		).toBe(true);
		expect(
			Result.isSuccess(validateTemplate(DEFAULT_ANNOTATION_TEMPLATE)),
		).toBe(true);
	});

	it("rejects unclosed blocks with a count", () => {
		const result = validateTemplate("{{#if a}}{{#if b}}x{{/if}}");
		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toBe(
				"Unclosed {{#if}} block: 1 opening tag(s) without matching {{/if}}",
			);
		}
	});

	it("rejects a closing tag before its opener", () => {
		const result = validateTemplate("{{/if}}{{#if a}}");
		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toBe(
				"Unexpected {{/if}} without matching {{#if}}",
			);
		}
	});
});

describe("renderTemplate", () => {
	it("interpolates variables and stringifies numbers", () => {
		expect(
			renderTemplate("{{a}} and {{b}} on page {{n}}", {
				a: "x",
				b: "y",
				n: 7,
			}),
		).toBe("x and y on page 7");
	});

	it("replaces missing variables with empty strings", () => {
		expect(renderTemplate("[{{missing}}]", {})).toBe("[]");
	});

	it("keeps truthy blocks and drops falsy ones", () => {
		expect(renderTemplate("{{#if a}}yes{{/if}}", { a: "v" })).toBe("yes");
		expect(renderTemplate("{{#if a}}yes{{/if}}", { a: "" })).toBe("");
		expect(renderTemplate("{{#if a}}yes{{/if}}", { a: 0 })).toBe("");
		expect(renderTemplate("{{#if a}}yes{{/if}}", {})).toBe("");
	});

	it("resolves nested conditionals", () => {
		const template = "{{#if a}}A{{#if b}}B{{/if}}{{#if c}}C{{/if}}{{/if}}";
		expect(renderTemplate(template, { a: 1, b: 1, c: "" })).toBe("AB");
		expect(renderTemplate(template, { a: "", b: 1, c: 1 })).toBe("");
	});

	it("handles sibling blocks", () => {
		expect(
			renderTemplate("{{#if a}}A{{/if}}-{{#if b}}B{{/if}}", { a: 1, b: 1 }),
		).toBe("A-B");
	});

	it("renders malformed templates as an empty string", () => {
		expect(renderTemplate("{{#if a}}open", { a: 1 })).toBe("");
		expect(renderTemplate("{{/if}}", {})).toBe("");
	});

	it("collapses runs of blank lines and trims outer newlines", () => {
		expect(renderTemplate("\n\na\n\n\n\nb\n\n", {})).toBe("a\n\nb");
	});

	it("renders the default template fully", () => {
		expect(
			renderTemplate(DEFAULT_ANNOTATION_TEMPLATE, {
				blockquote: "> quote",
				comment: "note",
				pageNumber: 3,
			}),
		).toBe("> quote\n\n*Note:* note\n\n<small>Page 3</small>");
	});

	it("omits empty sections of the default template", () => {
		expect(
			renderTemplate(DEFAULT_ANNOTATION_TEMPLATE, {
				blockquote: "> quote",
				comment: "",
				pageNumber: 0,
			}),
		).toBe("> quote");
	});

	it.prop(
		"leaves brace-free single-line text untouched",
		[NoBraces],
		([text]) => {
			expect(renderTemplate(text, {})).toBe(text);
		},
	);
});
