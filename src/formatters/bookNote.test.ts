/**
 * Tests for book note properties, tags, byline, and section.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import {
	Annotation,
	Book,
	DEFAULT_SETTINGS,
	type FormatOptions,
} from "../schemas.js";
import {
	BOOK_NOTE_KEYS,
	bookNote,
	bookProperties,
	bookSection,
	bookTags,
	byline,
	isGeneratedTag,
	linkOrText,
	MANAGED_NOTE_KEY,
	toSlug,
} from "./bookNote.js";
import { bookUrl } from "./links.js";

const BASE = new URL("https://kavita.example.com");
const options: FormatOptions = DEFAULT_SETTINGS;
const noLinks: FormatOptions = { ...options, includeWikilinks: false };

const named = (book: Book): Book => ({
	...book,
	bookTitle: "Cinders",
	seriesName: "The Lantern Cycle",
	seriesIndex: 2,
	authors: ["Ada Lumen", "Bram Coal"],
	genres: ["Fantasy", "Slow Burn"],
	annotations: [],
});

const annotated = (
	annotation: Annotation,
	overrides: Partial<Annotation>,
): Annotation => ({
	...annotation,
	selectedText: "Quoted",
	chapterTitle: "Cold Hearth",
	pageNumber: 1,
	containsSpoiler: false,
	createdUtc: "2026-01-01T00:00:00",
	lastModifiedUtc: "2026-01-01T00:00:00",
	...overrides,
});

describe("toSlug", () => {
	it("lowercases, hyphenates, and strips punctuation", () => {
		expect(toSlug("The Great Gatsby!")).toBe("the-great-gatsby");
		expect(toSlug("  Sci -- Fi  ")).toBe("sci-fi");
		expect(toSlug("???")).toBe("");
	});
});

describe("linkOrText", () => {
	it("follows the wikilink setting", () => {
		expect(linkOrText("Ada Lumen", options)).toBe("[[Ada Lumen]]");
		expect(linkOrText("Ada Lumen", noLinks)).toBe("Ada Lumen");
	});
});

describe("bookTags", () => {
	it.prop("generates series, author, and genre tags", [Book], ([book]) => {
		expect(bookTags(named(book), options)).toEqual([
			"kavita",
			"series/the-lantern-cycle",
			"author/ada-lumen",
			"author/bram-coal",
			"genre/fantasy",
			"genre/slow-burn",
		]);
	});

	it.prop("uses the genre prefix and skips empty slugs", [Book], ([book]) => {
		expect(
			bookTags(
				{ ...named(book), seriesName: "???", authors: ["!!"], genres: ["X"] },
				{ ...options, tagPrefix: "reading/" },
			),
		).toEqual(["kavita", "reading/x"]);
	});

	it.prop("dedupes repeated tags", [Book], ([book]) => {
		expect(
			bookTags(
				{ ...named(book), authors: ["Ada", "ada"], genres: [] },
				options,
			),
		).toEqual(["kavita", "series/the-lantern-cycle", "author/ada"]);
	});

	it.prop("is empty when tags are off", [Book], ([book]) => {
		expect(bookTags(book, { ...options, includeTags: false })).toEqual([]);
	});
});

describe("isGeneratedTag", () => {
	it("recognizes plugin tags and the configured prefix", () => {
		const owned = isGeneratedTag({ ...options, tagPrefix: "reading/" });
		expect(
			[
				"kavita",
				"series/x",
				"author/y",
				"genre/z",
				"reading/q",
				"to-read",
				"kavitas",
			].map(owned),
		).toEqual([true, true, true, true, true, false, false]);
	});

	it("does not claim every tag when the prefix is empty", () => {
		expect(isGeneratedTag(options)("anything")).toBe(false);
	});
});

describe("bookProperties", () => {
	it.prop("describes the book with links and Kavita ids", [Book], ([book]) => {
		const b = named(book);
		expect(bookProperties(b, options, BASE, "Covers/3.png")).toEqual({
			title: "Cinders",
			author: ["[[Ada Lumen]]", "[[Bram Coal]]"],
			series: "[[The Lantern Cycle]]",
			series_index: 2,
			genres: ["Fantasy", "Slow Burn"],
			cover: "[[Covers/3.png]]",
			highlights: 0,
			kavita_url: bookUrl(BASE, b),
			kavita_series_id: b.seriesId,
			[MANAGED_NOTE_KEY]: b.chapterId,
			tags: bookTags(b, options),
		});
	});

	it.prop(
		"uses plain names, no cover, and no tags when those are off",
		[Book],
		([book]) => {
			const properties = bookProperties(
				named(book),
				{ ...noLinks, includeTags: false },
				BASE,
				undefined,
			);
			expect(properties.author).toEqual(["Ada Lumen", "Bram Coal"]);
			expect(properties.series).toBe("The Lantern Cycle");
			expect(properties).not.toHaveProperty("cover");
			expect(properties).not.toHaveProperty("tags");
		},
	);

	it.prop(
		"counts visible highlights and dates the latest change",
		{ book: Book, a: Annotation, b: Annotation, c: Annotation },
		({ book, a, b, c }) => {
			const withHighlights = {
				...named(book),
				annotations: [
					annotated(a, { lastModifiedUtc: "2026-03-04T10:00:00" }),
					annotated(b, {
						lastModifiedUtc: "",
						createdUtc: "2026-05-06T10:00:00",
					}),
					annotated(c, {
						containsSpoiler: true,
						lastModifiedUtc: "2026-01-02T00:00:00",
					}),
				],
			};
			const properties = bookProperties(
				withHighlights,
				options,
				BASE,
				undefined,
			);
			expect(properties.highlights).toBe(2);
			expect(properties.last_highlighted).toBe("2026-05-06");
			expect(
				bookProperties(
					withHighlights,
					{ ...options, includeSpoilers: true },
					BASE,
					undefined,
				).highlights,
			).toBe(3);
		},
	);

	it.prop(
		"leaves out last_highlighted for a book with no highlights",
		[Book],
		([book]) => {
			expect(
				bookProperties(named(book), options, BASE, undefined),
			).not.toHaveProperty("last_highlighted");
		},
	);
});

describe("byline", () => {
	it.prop("names authors, series, and links to Kavita", [Book], ([book]) => {
		const b = named(book);
		expect(byline(b, options, BASE)).toBe(
			`by [[Ada Lumen]], [[Bram Coal]] · [[The Lantern Cycle]] #2 · [Open in Kavita](${bookUrl(BASE, b)})`,
		);
	});

	it.prop(
		"omits the series for standalone books and missing authors",
		[Book],
		([book]) => {
			const b = {
				...named(book),
				seriesName: "Cinders",
				authors: [],
			};
			expect(byline(b, noLinks, BASE)).toBe(
				`[Open in Kavita](${bookUrl(BASE, b)})`,
			);
		},
	);
});

describe("bookSection", () => {
	it.prop(
		"starts with the cover, then the byline, without a title heading",
		[Book],
		([book]) => {
			const b = named(book);
			const section = bookSection(b, options, BASE, "Covers/3.png");
			expect(
				section.startsWith(
					`![[Covers/3.png|160]]\n\n${byline(b, options, BASE)}\n\n`,
				),
			).toBe(true);
			expect(section).not.toMatch(/^# /m);
		},
	);

	it.prop(
		"starts with the byline when there is no cover",
		{ book: Book, a: Annotation },
		({ book, a }) => {
			const b = { ...named(book), annotations: [annotated(a, {})] };
			const section = bookSection(b, options, BASE, undefined);
			expect(section.startsWith(byline(b, options, BASE))).toBe(true);
			expect(section).toContain("\n\n## Cold Hearth\n\n> [!");
		},
	);
});

describe("bookNote", () => {
	it.prop("bundles properties, keys, and section", [Book], ([book]) => {
		const note = bookNote(book, options, BASE, "c.png");
		expect(note.ownedKeys).toBe(BOOK_NOTE_KEYS);
		expect(note.properties).toEqual(
			bookProperties(book, options, BASE, "c.png"),
		);
		expect(note.section).toBe(bookSection(book, options, BASE, "c.png"));
		expect(note.isOwnedTag("kavita")).toBe(true);
		expect(note.isOwnedTag("my-tag")).toBe(false);
	});

	it("owns every property it writes, plus the retired updated key", () => {
		expect(BOOK_NOTE_KEYS).toContain(MANAGED_NOTE_KEY);
		expect(BOOK_NOTE_KEYS).toContain("updated");
	});

	it.prop("writes only keys it owns, besides tags", [Book], ([book]) => {
		for (const key of Object.keys(
			bookProperties(book, options, BASE, "c.png"),
		)) {
			if (key !== "tags") expect(BOOK_NOTE_KEYS).toContain(key);
		}
	});
});
