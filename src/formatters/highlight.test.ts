/**
 * Tests for highlight rendering and chapter grouping.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, pipe, Schema } from "effect";
import {
	Annotation,
	DEFAULT_SETTINGS,
	type FormatOptions,
	HighlightColor,
} from "../schemas.js";
import {
	blockId,
	chapters,
	highlightColor,
	highlightVariables,
	readingOrder,
	renderChapters,
	renderHighlight,
	TEMPLATE_VARIABLES,
	visibleCount,
} from "./highlight.js";
import { annotationUrl } from "./links.js";

const BASE = new URL("https://kavita.example.com");
const options: FormatOptions = DEFAULT_SETTINGS;

const plain = (annotation: Annotation): Annotation => ({
	...annotation,
	selectedText: "Every fire begins.",
	comment: null,
	commentHtml: null,
	commentPlainText: null,
	chapterTitle: "The Spark",
	containsSpoiler: false,
	pageNumber: 12,
	selectedSlotIndex: 2,
	createdUtc: "2026-10-12T09:30:00",
	lastModifiedUtc: "2026-10-12T09:30:00",
});

const withComment = (annotation: Annotation, comment: string): Annotation => ({
	...plain(annotation),
	commentPlainText: comment,
});

describe("highlightColor", () => {
	it("maps Kavita's five slots in order", () => {
		expect([0, 1, 2, 3, 4].map(highlightColor)).toEqual([
			"cyan",
			"green",
			"yellow",
			"orange",
			"magenta",
		]);
	});

	it("wraps large and negative slots", () => {
		expect(highlightColor(5)).toBe("cyan");
		expect(highlightColor(12)).toBe("yellow");
		expect(highlightColor(-1)).toBe("magenta");
		expect(highlightColor(-5)).toBe("cyan");
	});

	it.prop("always yields a known color", [Schema.Int], ([slot]) => {
		expect(Schema.is(HighlightColor)(highlightColor(slot))).toBe(true);
		expect(highlightColor(slot)).toBe(highlightColor(slot + 5));
	});
});

describe("blockId", () => {
	it.prop("derives from the annotation id", [Annotation], ([annotation]) => {
		expect(blockId(annotation)).toBe(`kavita-${annotation.id}`);
	});
});

describe("highlightVariables", () => {
	it.prop(
		"quotes every line, marking blank lines with a bare >",
		[Annotation],
		([annotation]) => {
			const variables = highlightVariables(
				{ ...plain(annotation), selectedText: "line one\n\nline three" },
				options,
				BASE,
			);
			expect(variables.quote).toBe("> line one\n>\n> line three");
			expect(variables.blockquote).toBe(variables.quote);
			expect(variables.selectedText).toBe("line one\n\nline three");
		},
	);

	it.prop(
		"continues multi-line comments inside the quote",
		[Annotation],
		([annotation]) => {
			const variables = highlightVariables(
				withComment(annotation, "first\nsecond"),
				options,
				BASE,
			);
			expect(variables.comment).toBe("first\nsecond");
			expect(variables.commentQuote).toBe("first\n> second");
		},
	);

	it.prop(
		"drops comments when they are turned off",
		[Annotation],
		([annotation]) => {
			const variables = highlightVariables(
				withComment(annotation, "note"),
				{ ...options, includeComments: false },
				BASE,
			);
			expect(variables.comment).toBe("");
			expect(variables.commentQuote).toBe("");
		},
	);

	it.prop(
		"picks a colored callout, or a plain quote",
		[Annotation],
		([annotation]) => {
			const a = plain(annotation);
			expect(highlightVariables(a, options, BASE).callout).toBe(
				"kavita-yellow",
			);
			expect(highlightVariables(a, options, BASE).color).toBe("yellow");
			expect(
				highlightVariables(a, { ...options, highlightColors: false }, BASE)
					.callout,
			).toBe("quote");
		},
	);

	it.prop("folds and labels spoilers", [Annotation], ([annotation]) => {
		const variables = highlightVariables(
			{ ...plain(annotation), containsSpoiler: true, pageNumber: 4 },
			options,
			BASE,
		);
		expect(variables.fold).toBe("-");
		expect(variables.location).toBe("Spoiler · Page 4");
		const open = highlightVariables(plain(annotation), options, BASE);
		expect(open.fold).toBe("");
		expect(open.location).toBe("Page 12");
	});

	it.prop(
		"labels highlights without a page",
		[Annotation, Schema.Int.check(Schema.isLessThanOrEqualTo(0))],
		([annotation, page]) => {
			const variables = highlightVariables(
				{ ...plain(annotation), pageNumber: page },
				options,
				BASE,
			);
			expect(variables.location).toBe("Highlight");
			expect(variables.pageNumber).toBe(0);
		},
	);

	it.prop(
		"links to the highlight and dates it",
		[Annotation],
		([annotation]) => {
			const a = plain(annotation);
			const variables = highlightVariables(a, options, BASE);
			expect(variables.link).toBe(annotationUrl(BASE, a));
			expect(variables.date).toBe("2026-10-12");
			expect(variables.chapterTitle).toBe("The Spark");
		},
	);

	it.prop(
		"provides every variable the editor advertises",
		[Annotation],
		([annotation]) => {
			const variables = highlightVariables(annotation, options, BASE);
			for (const [name] of TEMPLATE_VARIABLES) {
				expect(variables).toHaveProperty(name);
			}
		},
	);
});

describe("renderHighlight", () => {
	it.prop(
		"renders the default callout with the note inside it",
		[Annotation],
		([annotation]) => {
			const a = withComment(annotation, "Opening line");
			const rendered = renderHighlight(a, options, BASE);
			expect(rendered).toEqual(
				Option.some(
					[
						`> [!kavita-yellow] [Page 12](${annotationUrl(BASE, a)})`,
						"> Every fire begins.",
						">",
						"> **Note:** Opening line",
						"",
						`^kavita-${a.id}`,
					].join("\n"),
				),
			);
		},
	);

	it.prop(
		"renders the default callout without a note",
		[Annotation],
		([annotation]) => {
			const a = plain(annotation);
			expect(renderHighlight(a, options, BASE)).toEqual(
				Option.some(
					`> [!kavita-yellow] [Page 12](${annotationUrl(BASE, a)})\n> Every fire begins.\n\n^kavita-${a.id}`,
				),
			);
		},
	);

	it.prop(
		"keeps the note in the same callout as the quote",
		[Annotation],
		([annotation]) => {
			const rendered = Option.getOrElse(
				renderHighlight(withComment(annotation, "note"), options, BASE),
				() => "",
			);
			expect(rendered).toContain("> Every fire begins.\n>\n> **Note:** note");
			expect(rendered).not.toContain("Every fire begins.\n\n");
		},
	);

	it.prop(
		"hides spoilers unless they are included",
		[Annotation],
		([annotation]) => {
			const spoiler = { ...plain(annotation), containsSpoiler: true };
			expect(Option.isNone(renderHighlight(spoiler, options, BASE))).toBe(true);
			expect(
				Option.getOrElse(
					renderHighlight(spoiler, { ...options, includeSpoilers: true }, BASE),
					() => "",
				).startsWith("> [!kavita-yellow]- [Spoiler · Page 12]"),
			).toBe(true);
		},
	);

	it.prop("renders custom templates", [Annotation], ([annotation]) => {
		const a = plain(annotation);
		expect(
			renderHighlight(
				a,
				{ ...options, annotationTemplate: "{{selectedText}} ({{date}})" },
				BASE,
			),
		).toEqual(
			Option.some(`Every fire begins. (2026-10-12)\n\n^kavita-${a.id}`),
		);
	});

	it.prop(
		"falls back to the default template when the template is empty",
		[Annotation],
		([annotation]) => {
			const a = plain(annotation);
			expect(
				renderHighlight(a, { ...options, annotationTemplate: "" }, BASE),
			).toEqual(renderHighlight(a, options, BASE));
		},
	);

	it.prop(
		"skips highlights that render to nothing",
		[Annotation],
		([annotation]) => {
			expect(
				renderHighlight(
					plain(annotation),
					{
						...options,
						annotationTemplate: "{{#if comment}}{{comment}}{{/if}}",
					},
					BASE,
				),
			).toEqual(Option.none());
		},
	);
});

describe("chapters", () => {
	it.prop(
		"groups consecutive chapters in reading order",
		{
			a: Annotation,
			b: Annotation,
			c: Annotation,
			d: Annotation,
			e: Annotation,
		},
		({ a, b, c, d, e }) => {
			const late = {
				...plain(a),
				pageNumber: 2,
				chapterTitle: "Second",
			};
			const first = {
				...plain(b),
				pageNumber: 1,
				chapterTitle: "First",
				createdUtc: "2026-01-01T00:00:00",
			};
			const firstLater = {
				...plain(c),
				pageNumber: 1,
				chapterTitle: "First",
				createdUtc: "2026-02-01T00:00:00",
			};
			const untitled = { ...plain(d), pageNumber: 3, chapterTitle: null };
			const blank = { ...plain(e), pageNumber: 4, chapterTitle: "   " };
			expect(chapters([untitled, late, firstLater, blank, first])).toEqual([
				["First", [first, firstLater]],
				["Second", [late]],
				["Highlights", [untitled, blank]],
			]);
		},
	);

	it.prop(
		"starts a new group when a chapter recurs later",
		{ a: Annotation, b: Annotation, c: Annotation },
		({ a, b, c }) => {
			const titles = chapters([
				{ ...plain(a), pageNumber: 1, chapterTitle: "A" },
				{ ...plain(b), pageNumber: 2, chapterTitle: "B" },
				{ ...plain(c), pageNumber: 3, chapterTitle: "A" },
			]).map(([title]) => title);
			expect(titles).toEqual(["A", "B", "A"]);
		},
	);

	it.prop(
		"keeps every highlight, in reading order",
		[Schema.Array(Annotation)],
		([annotations]) => {
			const flattened = chapters(annotations).flatMap(([, group]) => group);
			expect(flattened).toEqual(pipe(annotations, Arr.sort(readingOrder)));
		},
	);
});

describe("renderChapters", () => {
	it.prop("uses the requested heading level", [Annotation], ([annotation]) => {
		const a = plain(annotation);
		const rendered = renderChapters([a], options, BASE, 3);
		expect(rendered.startsWith("### The Spark\n\n> [!kavita-yellow]")).toBe(
			true,
		);
		expect(rendered.endsWith(`^kavita-${a.id}`)).toBe(true);
	});

	it.prop(
		"separates highlights and chapters with blank lines",
		{ a: Annotation, b: Annotation, c: Annotation },
		({ a, b, c }) => {
			const one = { ...plain(a), id: 1, pageNumber: 1, chapterTitle: "One" };
			const two = { ...plain(b), id: 2, pageNumber: 1, chapterTitle: "One" };
			const three = {
				...plain(c),
				id: 3,
				pageNumber: 2,
				chapterTitle: "Two",
			};
			const rendered = renderChapters([one, two, three], options, BASE, 2);
			expect(rendered).toContain("^kavita-1\n\n> [!kavita-yellow]");
			expect(rendered).toContain("^kavita-2\n\n## Two\n\n");
		},
	);

	it("says so when there is nothing to show", () => {
		expect(renderChapters([], options, BASE, 2)).toBe(
			"*No highlights to show yet.*",
		);
	});

	it.prop(
		"drops chapters whose highlights are all hidden",
		{ a: Annotation, b: Annotation },
		({ a, b }) => {
			const hidden = {
				...plain(a),
				pageNumber: 1,
				chapterTitle: "Secret",
				containsSpoiler: true,
			};
			expect(renderChapters([hidden], options, BASE, 2)).toBe(
				"*No highlights to show yet.*",
			);
			const shown = { ...plain(b), pageNumber: 2, chapterTitle: "Open" };
			const rendered = renderChapters([hidden, shown], options, BASE, 2);
			expect(rendered.startsWith("## Open\n\n")).toBe(true);
			expect(rendered).not.toContain("## Secret");
		},
	);
});

describe("visibleCount", () => {
	it.prop(
		"counts spoilers only when they are included",
		[Schema.Array(Annotation)],
		([annotations]) => {
			expect(visibleCount(annotations, options)).toBe(
				annotations.filter((a) => !a.containsSpoiler).length,
			);
			expect(
				visibleCount(annotations, { ...options, includeSpoilers: true }),
			).toBe(annotations.length);
		},
	);
});
