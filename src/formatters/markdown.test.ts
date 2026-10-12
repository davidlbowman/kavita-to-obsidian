/**
 * Tests for single-file markdown rendering.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";
import {
	Annotation,
	ChapterInfo,
	DEFAULT_SETTINGS,
	type FormatOptions,
} from "../schemas.js";
import {
	type ChapterInfoMap,
	formatAnnotation,
	generateBookHeader,
	generateFrontmatter,
	generateSeriesHeader,
	getBookTitle,
	getChapterTitle,
	getLibraryName,
	getSeriesName,
	getSortedBookGroups,
	makeTag,
	makeWikilink,
	toMarkdown,
	toSlug,
} from "./markdown.js";

const UPDATED = "2024-05-06T07:08:09.000Z";

const options: FormatOptions = DEFAULT_SETTINGS;

const plain = (annotation: Annotation): Annotation => ({
	...annotation,
	containsSpoiler: false,
	selectedText: "Quoted text",
	comment: null,
	commentHtml: null,
	commentPlainText: null,
	pageNumber: 0,
});

const catalog = (...entries: Array<ChapterInfo>): ChapterInfoMap =>
	new Map(entries.map((info) => [info.chapterId, info]));

const render = (
	annotation: Annotation,
	overrides: Partial<FormatOptions> = {},
) => formatAnnotation(annotation, { ...options, ...overrides });

describe("formatAnnotation", () => {
	it.prop(
		"hides spoilers unless enabled",
		{ annotation: Annotation },
		({ annotation }) => {
			const spoiler = { ...plain(annotation), containsSpoiler: true };
			expect(Result.isFailure(render(spoiler))).toBe(true);
			expect(render(spoiler, { includeSpoilers: true })).toEqual(
				Result.succeed("> Quoted text"),
			);
		},
	);

	it.prop(
		"renders blockquote, comment, and page with the default template",
		{ annotation: Annotation },
		({ annotation }) => {
			const full = {
				...plain(annotation),
				selectedText: "line one\nTom &amp; Jerry",
				commentPlainText: " a note ",
				pageNumber: 12,
			};
			expect(render(full)).toEqual(
				Result.succeed(
					"> line one\n> Tom & Jerry\n\n*Note:* a note\n\n<small>Page 12</small>",
				),
			);
			expect(render(full, { includeComments: false })).toEqual(
				Result.succeed("> line one\n> Tom & Jerry\n\n<small>Page 12</small>"),
			);
		},
	);

	it.prop(
		"omits non-positive page numbers and treats missing text as empty",
		{ annotation: Annotation },
		({ annotation }) => {
			expect(render({ ...plain(annotation), pageNumber: -3 })).toEqual(
				Result.succeed("> Quoted text"),
			);
			expect(render({ ...plain(annotation), selectedText: null })).toEqual(
				Result.succeed("> "),
			);
		},
	);

	it.prop(
		"exposes chapter, series, and timestamp to custom templates",
		{ annotation: Annotation },
		({ annotation }) => {
			const a = {
				...plain(annotation),
				chapterTitle: "Ch",
				seriesName: "Series",
				createdUtc: "2020-01-01",
			};
			expect(
				render(a, {
					annotationTemplate:
						"{{chapterTitle}}|{{seriesName}}|{{createdUtc}}|{{selectedText}}",
				}),
			).toEqual(Result.succeed("Ch|Series|2020-01-01|Quoted text"));
			expect(
				render(
					{ ...a, chapterTitle: null, seriesName: null },
					{ annotationTemplate: "[{{chapterTitle}}{{seriesName}}]" },
				),
			).toEqual(Result.succeed("[]"));
		},
	);

	it.prop(
		"falls back to the default template when the template is blank",
		{ annotation: Annotation },
		({ annotation }) => {
			expect(render(plain(annotation), { annotationTemplate: "" })).toEqual(
				Result.succeed("> Quoted text"),
			);
		},
	);

	it.prop(
		"fails when the template renders nothing",
		{ annotation: Annotation },
		({ annotation }) => {
			expect(
				Result.isFailure(
					render(
						{ ...plain(annotation), commentPlainText: "note" },
						{ includeComments: false, annotationTemplate: "{{comment}}" },
					),
				),
			).toBe(true);
		},
	);
});

describe("slugs, tags, and wikilinks", () => {
	it("slugifies names", () => {
		expect(toSlug("  The Great Gatsby!  ")).toBe("the-great-gatsby");
		expect(toSlug("Sci-Fi -- & Fantasy")).toBe("sci-fi-fantasy");
		expect(toSlug("Café")).toBe("caf");
	});

	it.prop("slugs are tag-safe", [Schema.String], ([input]) => {
		const slug = toSlug(input);
		expect(slug).toMatch(/^[a-z0-9-]*$/);
		expect(slug).not.toMatch(/^-|-$|--/);
	});

	it("builds tags and wikilinks", () => {
		expect(makeTag("Science Fiction")).toBe("#science-fiction");
		expect(makeTag("Science Fiction", "genre/")).toBe("#genre/science-fiction");
		expect(makeWikilink("Ada Lumen")).toBe("[[Ada Lumen]]");
	});
});

describe("name fallbacks", () => {
	it.prop(
		"falls back to IDs when names are missing",
		{ annotation: Annotation },
		({ annotation }) => {
			const bare = {
				...annotation,
				seriesName: null,
				chapterTitle: null,
				libraryName: null,
			};
			expect(getSeriesName(bare)).toBe(`Series ${annotation.seriesId}`);
			expect(getChapterTitle(bare)).toBe(`Chapter ${annotation.chapterId}`);
			expect(getLibraryName(bare)).toBe(`Library ${annotation.libraryId}`);
			expect(getBookTitle(bare, new Map())).toBe(
				`Series ${annotation.seriesId}`,
			);
		},
	);

	it.prop(
		"uses names and chapter info when present",
		{ annotation: Annotation, info: ChapterInfo },
		({ annotation, info }) => {
			const named = {
				...annotation,
				seriesName: "S",
				chapterTitle: "C",
				libraryName: "L",
			};
			expect(getSeriesName(named)).toBe("S");
			expect(getChapterTitle(named)).toBe("C");
			expect(getLibraryName(named)).toBe("L");
			expect(
				getBookTitle(
					named,
					catalog({ ...info, chapterId: annotation.chapterId }),
				),
			).toBe(info.bookTitle);
		},
	);
});

describe("headers", () => {
	it("renders a book header with wikilinks, genres, and tags", () => {
		expect(
			generateBookHeader(
				"Embers",
				{ ...options, tagPrefix: "genre/" },
				["Ada", "Bram"],
				["Fantasy", "Science Fiction"],
			),
		).toEqual([
			"### Embers",
			"**Author:** [[Ada]], [[Bram]]",
			"**Book:** [[Embers]]",
			"**Genres:** Fantasy, Science Fiction",
			"**Tags:** #genre/fantasy #genre/science-fiction",
		]);
	});

	it("renders a plain book header without wikilinks or tags", () => {
		expect(
			generateBookHeader(
				"Embers",
				{ ...options, includeWikilinks: false, includeTags: false },
				["Ada"],
				["Fantasy"],
			),
		).toEqual(["### Embers", "**Author:** Ada", "**Genres:** Fantasy"]);
		expect(generateBookHeader("Embers", options, [], [])).toEqual([
			"### Embers",
			"**Book:** [[Embers]]",
		]);
	});

	it.prop(
		"renders a series header with and without wikilinks",
		{ annotation: Annotation },
		({ annotation }) => {
			const a = { ...annotation, seriesName: "S", libraryName: "L" };
			expect(generateSeriesHeader(a, options)).toEqual([
				"## S",
				"**Series:** [[S]]",
				"**Library:** L",
			]);
			expect(
				generateSeriesHeader(a, { ...options, includeWikilinks: false }),
			).toEqual(["## S", "**Library:** L"]);
		},
	);

	it("renders frontmatter with the injected timestamp", () => {
		expect(generateFrontmatter(options, UPDATED)).toBe(
			`---\ntitle: Kavita Annotations\ntags:\n  - annotations\n  - kavita\nupdated: ${UPDATED}\n---`,
		);
		expect(
			generateFrontmatter({ ...options, includeTags: false }, UPDATED),
		).toBe(`---\ntitle: Kavita Annotations\nupdated: ${UPDATED}\n---`);
	});
});

describe("getSortedBookGroups", () => {
	it.prop(
		"orders books by sort order and defaults unknown books to 0",
		{ a: Annotation, b: Annotation, c: Annotation },
		({ a, b, c }) => {
			const first = { ...a, chapterId: 1, seriesName: "S" };
			const second = { ...b, chapterId: 2, seriesName: "S" };
			const unknown = { ...c, chapterId: 3, seriesName: "Unknown" };
			const groups = getSortedBookGroups(
				[second, first, unknown],
				catalog(
					{
						chapterId: 1,
						bookTitle: "One",
						sortOrder: 1,
						authors: [],
						genres: [],
					},
					{
						chapterId: 2,
						bookTitle: "Two",
						sortOrder: 2,
						authors: [],
						genres: [],
					},
				),
			);
			expect(groups.map(([title]) => title)).toEqual(["Unknown", "One", "Two"]);
		},
	);
});

describe("toMarkdown", () => {
	it("renders an empty document", () => {
		expect(toMarkdown([], options, new Map(), UPDATED)).toBe(
			`${generateFrontmatter(options, UPDATED)}\n\n# Kavita Annotations\n\n*No annotations found.*\n`,
		);
	});

	it.prop(
		"groups by series, book, and chapter in volume order",
		{ a: Annotation, b: Annotation, c: Annotation },
		({ a, b, c }) => {
			const base = {
				seriesName: "Lantern",
				libraryName: "Books",
				seriesId: a.seriesId,
			};
			const late = {
				...plain(a),
				...base,
				chapterId: a.chapterId,
				chapterTitle: "Late chapter",
				selectedText: "late quote",
			};
			const early = {
				...plain(b),
				...base,
				chapterId: a.chapterId + 1,
				chapterTitle: "Early chapter",
				selectedText: "early quote",
			};
			const hidden = {
				...early,
				id: c.id,
				containsSpoiler: true,
				selectedText: "secret",
			};
			const doc = toMarkdown(
				[late, early, hidden],
				options,
				catalog(
					{
						chapterId: late.chapterId,
						bookTitle: "Cinders",
						sortOrder: 2,
						authors: ["Ada"],
						genres: ["Fantasy"],
					},
					{
						chapterId: early.chapterId,
						bookTitle: "Embers",
						sortOrder: 1,
						authors: [],
						genres: [],
					},
				),
				UPDATED,
			);
			expect(doc.startsWith(generateFrontmatter(options, UPDATED))).toBe(true);
			expect(doc).toContain(
				"# Kavita Annotations\n\n## Lantern\n**Series:** [[Lantern]]\n**Library:** Books\n",
			);
			expect(doc.indexOf("### Embers")).toBeLessThan(
				doc.indexOf("### Cinders"),
			);
			expect(doc).toContain(
				"### Cinders\n**Author:** [[Ada]]\n**Book:** [[Cinders]]\n**Genres:** Fantasy\n**Tags:** #fantasy\n\n#### Chapter: Late chapter\n\n> late quote\n\n---\n",
			);
			expect(doc).toContain(
				"#### Chapter: Early chapter\n\n> early quote\n\n---\n",
			);
			expect(doc).not.toContain("secret");
		},
	);

	it.prop(
		"renders one section per series",
		{ a: Annotation, b: Annotation },
		({ a, b }) => {
			const one = { ...plain(a), seriesName: "One", seriesId: 1 };
			const two = { ...plain(b), seriesName: "Two", seriesId: 2 };
			const doc = toMarkdown(
				[two, one],
				{ ...options, includeWikilinks: false },
				new Map(),
				UPDATED,
			);
			expect(doc).toContain("## One\n**Library:**");
			expect(doc).toContain("## Two\n**Library:**");
			expect(doc).toContain("### One\n");
			expect(doc).not.toContain("[[");
		},
	);
});
