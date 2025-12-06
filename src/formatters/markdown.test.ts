/**
 * Tests for markdown formatter functions.
 *
 * @module
 */
import { Option } from "effect";
import { describe, expect, it } from "vitest";
import type { AnnotationDto, SeriesMetadataDto } from "../schemas.js";
import {
	type ChapterInfoMap,
	type FormatOptions,
	formatAnnotation,
	generateBookHeader,
	generateFrontmatter,
	generateSeriesHeader,
	getAuthorNames,
	getBookSortOrder,
	getBookTitle,
	getChapterTitle,
	getGenreNames,
	getLibraryName,
	getSeriesName,
	getSortedBookGroups,
	groupByBookTitle,
	groupByChapterId,
	groupBySeriesId,
	makeTag,
	makeWikilink,
	type SeriesMetadataMap,
	toMarkdown,
	toSlug,
} from "./markdown.js";

const defaultOptions: FormatOptions = {
	includeComments: true,
	includeSpoilers: false,
	includeTags: true,
	tagPrefix: "kavita/",
	includeWikilinks: true,
};

const createAnnotation = (
	overrides: Partial<typeof AnnotationDto.Type> = {},
): typeof AnnotationDto.Type => ({
	id: 1,
	xPath: "/html/body/p[1]",
	endingXPath: null,
	selectedText: "Test highlight",
	comment: null,
	commentHtml: null,
	commentPlainText: null,
	chapterTitle: null,
	context: null,
	highlightCount: 14,
	containsSpoiler: false,
	pageNumber: 1,
	selectedSlotIndex: 0,
	likes: [],
	seriesName: null,
	libraryName: null,
	chapterId: 1,
	volumeId: 1,
	seriesId: 1,
	libraryId: 1,
	ownerUserId: 1,
	ownerUsername: null,
	ageRating: 0,
	createdUtc: "2025-01-01T00:00:00Z",
	lastModifiedUtc: "2025-01-01T00:00:00Z",
	...overrides,
});

describe("toSlug", () => {
	it("converts to lowercase", () => {
		expect(toSlug("Hello World")).toBe("hello-world");
	});

	it("replaces spaces with hyphens", () => {
		expect(toSlug("the great gatsby")).toBe("the-great-gatsby");
	});

	it("removes special characters", () => {
		expect(toSlug("F. Scott Fitzgerald")).toBe("f-scott-fitzgerald");
	});

	it("collapses multiple hyphens", () => {
		expect(toSlug("Fiction & Literature")).toBe("fiction-literature");
	});

	it("trims leading and trailing hyphens", () => {
		expect(toSlug("  Hello  ")).toBe("hello");
	});
});

describe("makeTag", () => {
	it("creates prefixed tag with slug", () => {
		expect(makeTag("kavita/", "series", "The Great Gatsby")).toBe(
			"#kavita/series/the-great-gatsby",
		);
	});

	it("works with different prefixes", () => {
		expect(makeTag("book/", "author", "F. Scott Fitzgerald")).toBe(
			"#book/author/f-scott-fitzgerald",
		);
	});
});

describe("makeWikilink", () => {
	it("creates wikilink", () => {
		expect(makeWikilink("The Great Gatsby")).toBe("[[The Great Gatsby]]");
	});
});

describe("getSeriesName", () => {
	it("returns seriesName when present", () => {
		const annotation = createAnnotation({ seriesName: "The Great Gatsby" });
		expect(getSeriesName(annotation)).toBe("The Great Gatsby");
	});

	it("falls back to seriesId when seriesName is null", () => {
		const annotation = createAnnotation({ seriesName: null, seriesId: 123 });
		expect(getSeriesName(annotation)).toBe("Series 123");
	});
});

describe("getChapterTitle", () => {
	it("returns chapterTitle when present", () => {
		const annotation = createAnnotation({
			chapterTitle: "Chapter 1: The Beginning",
		});
		expect(getChapterTitle(annotation)).toBe("Chapter 1: The Beginning");
	});

	it("falls back to chapterId when chapterTitle is null", () => {
		const annotation = createAnnotation({ chapterTitle: null, chapterId: 42 });
		expect(getChapterTitle(annotation)).toBe("Chapter 42");
	});
});

describe("getLibraryName", () => {
	it("returns libraryName when present", () => {
		const annotation = createAnnotation({ libraryName: "Fiction" });
		expect(getLibraryName(annotation)).toBe("Fiction");
	});

	it("falls back to libraryId when libraryName is null", () => {
		const annotation = createAnnotation({ libraryName: null, libraryId: 5 });
		expect(getLibraryName(annotation)).toBe("Library 5");
	});
});

const createMetadata = (
	overrides: Partial<typeof SeriesMetadataDto.Type> = {},
): typeof SeriesMetadataDto.Type => ({
	id: 1,
	seriesId: 1,
	summary: null,
	releaseYear: 2020,
	language: null,
	genres: [],
	tags: [],
	writers: [],
	coverArtists: [],
	publishers: [],
	characters: [],
	pencillers: [],
	inkers: [],
	colorists: [],
	letterers: [],
	editors: [],
	translators: [],
	...overrides,
});

describe("getAuthorNames", () => {
	it("returns empty array when metadata is undefined", () => {
		expect(getAuthorNames(undefined)).toEqual([]);
	});

	it("returns empty array when writers is empty", () => {
		const metadata = createMetadata({ writers: [] });
		expect(getAuthorNames(metadata)).toEqual([]);
	});

	it("returns writer names", () => {
		const metadata = createMetadata({
			writers: [
				{ id: 1, name: "F. Scott Fitzgerald", description: null },
				{ id: 2, name: "Ernest Hemingway", description: null },
			],
		});
		expect(getAuthorNames(metadata)).toEqual([
			"F. Scott Fitzgerald",
			"Ernest Hemingway",
		]);
	});
});

describe("getGenreNames", () => {
	it("returns empty array when metadata is undefined", () => {
		expect(getGenreNames(undefined)).toEqual([]);
	});

	it("returns empty array when genres is empty", () => {
		const metadata = createMetadata({ genres: [] });
		expect(getGenreNames(metadata)).toEqual([]);
	});

	it("returns genre titles", () => {
		const metadata = createMetadata({
			genres: [
				{ id: 1, title: "Fiction" },
				{ id: 2, title: "Classic" },
			],
		});
		expect(getGenreNames(metadata)).toEqual(["Fiction", "Classic"]);
	});
});

describe("generateFrontmatter", () => {
	it("generates frontmatter with tags", () => {
		const result = generateFrontmatter(defaultOptions);
		expect(result).toContain("---");
		expect(result).toContain("title: Kavita Annotations");
		expect(result).toContain("tags:");
		expect(result).toContain("  - kavita");
		expect(result).toContain("  - annotations");
		expect(result).toContain("updated:");
	});

	it("omits tags when includeTags is false", () => {
		const result = generateFrontmatter({
			...defaultOptions,
			includeTags: false,
		});
		expect(result).not.toContain("tags:");
		expect(result).toContain("title: Kavita Annotations");
	});
});

describe("generateSeriesHeader", () => {
	it("generates header with wikilinks and tags", () => {
		const annotation = createAnnotation({
			seriesName: "The Great Gatsby",
			libraryName: "Fiction",
		});
		const lines = generateSeriesHeader(annotation, defaultOptions);

		expect(lines).toContain("## The Great Gatsby");
		expect(lines).toContain("**Series:** [[The Great Gatsby]]");
		expect(lines).toContain("**Library:** Fiction");
		expect(
			lines.some((l) => l.includes("#kavita/series/the-great-gatsby")),
		).toBe(true);
		expect(lines.some((l) => l.includes("#kavita/library/fiction"))).toBe(true);
	});

	it("omits wikilinks when disabled", () => {
		const annotation = createAnnotation({ seriesName: "Test Series" });
		const lines = generateSeriesHeader(annotation, {
			...defaultOptions,
			includeWikilinks: false,
		});

		expect(lines).not.toContain("**Series:** [[Test Series]]");
		expect(lines).toContain("## Test Series");
	});

	it("omits tags when disabled", () => {
		const annotation = createAnnotation({ seriesName: "Test Series" });
		const lines = generateSeriesHeader(annotation, {
			...defaultOptions,
			includeTags: false,
		});

		expect(lines.some((l) => l.includes("**Tags:**"))).toBe(false);
	});

	it("includes author from metadata with wikilinks", () => {
		const annotation = createAnnotation({ seriesName: "The Great Gatsby" });
		const metadata = createMetadata({
			writers: [{ id: 1, name: "F. Scott Fitzgerald", description: null }],
		});
		const lines = generateSeriesHeader(annotation, defaultOptions, metadata);

		expect(lines).toContain("**Author:** [[F. Scott Fitzgerald]]");
		expect(
			lines.some((l) => l.includes("#kavita/author/f-scott-fitzgerald")),
		).toBe(true);
	});

	it("includes multiple authors", () => {
		const annotation = createAnnotation({ seriesName: "Collaboration" });
		const metadata = createMetadata({
			writers: [
				{ id: 1, name: "Author One", description: null },
				{ id: 2, name: "Author Two", description: null },
			],
		});
		const lines = generateSeriesHeader(annotation, defaultOptions, metadata);

		expect(lines).toContain("**Author:** [[Author One]], [[Author Two]]");
	});

	it("includes genres from metadata", () => {
		const annotation = createAnnotation({ seriesName: "Test Book" });
		const metadata = createMetadata({
			genres: [
				{ id: 1, title: "Fiction" },
				{ id: 2, title: "Classic" },
			],
		});
		const lines = generateSeriesHeader(annotation, defaultOptions, metadata);

		expect(lines).toContain("**Genres:** Fiction, Classic");
		expect(lines.some((l) => l.includes("#kavita/genre/fiction"))).toBe(true);
		expect(lines.some((l) => l.includes("#kavita/genre/classic"))).toBe(true);
	});

	it("works without metadata", () => {
		const annotation = createAnnotation({ seriesName: "Test Book" });
		const lines = generateSeriesHeader(annotation, defaultOptions);

		expect(lines).toContain("## Test Book");
		expect(lines.some((l) => l.includes("**Author:**"))).toBe(false);
		expect(lines.some((l) => l.includes("**Genres:**"))).toBe(false);
	});
});

describe("formatAnnotation", () => {
	it("formats basic annotation", () => {
		const annotation = createAnnotation({
			selectedText: "Hello world",
			pageNumber: 0,
		});
		const result = formatAnnotation(annotation, defaultOptions);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toBe("> Hello world");
		}
	});

	it("includes comment when enabled", () => {
		const annotation = createAnnotation({
			selectedText: "Highlight",
			comment: "My note",
		});
		const result = formatAnnotation(annotation, defaultOptions);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toContain("*Note:* My note");
		}
	});

	it("excludes comment when disabled", () => {
		const annotation = createAnnotation({
			selectedText: "Highlight",
			comment: "My note",
		});
		const result = formatAnnotation(annotation, {
			...defaultOptions,
			includeComments: false,
		});

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).not.toContain("My note");
		}
	});

	it("includes page number when present", () => {
		const annotation = createAnnotation({
			selectedText: "Highlight",
			pageNumber: 42,
		});
		const result = formatAnnotation(annotation, defaultOptions);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toContain("<small>Page 42</small>");
		}
	});

	it("filters spoilers when disabled", () => {
		const annotation = createAnnotation({
			selectedText: "Spoiler",
			containsSpoiler: true,
		});
		const result = formatAnnotation(annotation, defaultOptions);

		expect(Option.isNone(result)).toBe(true);
	});

	it("includes spoilers when enabled", () => {
		const annotation = createAnnotation({
			selectedText: "Spoiler",
			containsSpoiler: true,
		});
		const result = formatAnnotation(annotation, {
			...defaultOptions,
			includeSpoilers: true,
		});

		expect(Option.isSome(result)).toBe(true);
	});
});

describe("groupBySeriesId", () => {
	it("groups annotations by series", () => {
		const annotations = [
			createAnnotation({ id: 1, seriesId: 1 }),
			createAnnotation({ id: 2, seriesId: 1 }),
			createAnnotation({ id: 3, seriesId: 2 }),
		];

		const groups = groupBySeriesId(annotations);

		expect(Object.keys(groups).length).toBe(2);
		expect(groups["1"]?.length).toBe(2);
		expect(groups["2"]?.length).toBe(1);
	});
});

describe("groupByChapterId", () => {
	it("groups annotations by chapter", () => {
		const annotations = [
			createAnnotation({ id: 1, chapterId: 1 }),
			createAnnotation({ id: 2, chapterId: 1 }),
			createAnnotation({ id: 3, chapterId: 2 }),
		];

		const groups = groupByChapterId(annotations);

		expect(Object.keys(groups).length).toBe(2);
		expect(groups["1"]?.length).toBe(2);
		expect(groups["2"]?.length).toBe(1);
	});
});

describe("toMarkdown", () => {
	it("returns empty message for no annotations", () => {
		const result = toMarkdown([], defaultOptions);

		expect(result).toContain("---");
		expect(result).toContain("title: Kavita Annotations");
		expect(result).toContain("# Kavita Annotations");
		expect(result).toContain("*No annotations found.*");
	});

	it("generates markdown with series name and chapter title", () => {
		const annotations = [
			createAnnotation({
				id: 1,
				seriesId: 1,
				seriesName: "The Great Gatsby",
				chapterId: 1,
				chapterTitle: "Chapter 1: In My Younger Years",
				libraryName: "Fiction",
				selectedText: "First highlight",
			}),
		];

		const result = toMarkdown(annotations, defaultOptions);

		expect(result).toContain("## The Great Gatsby");
		expect(result).toContain("### Chapter 1: In My Younger Years");
		expect(result).toContain("**Series:** [[The Great Gatsby]]");
		expect(result).toContain("**Library:** Fiction");
		expect(result).toContain("#kavita/series/the-great-gatsby");
		expect(result).toContain("> First highlight");
	});

	it("falls back to IDs when names are missing", () => {
		const annotations = [
			createAnnotation({
				id: 1,
				seriesId: 123,
				seriesName: null,
				chapterId: 456,
				chapterTitle: null,
				libraryName: null,
				libraryId: 7,
				selectedText: "Highlight",
			}),
		];

		const result = toMarkdown(annotations, defaultOptions);

		expect(result).toContain("## Series 123");
		expect(result).toContain("### Chapter 456");
		expect(result).toContain("**Library:** Library 7");
	});

	it("generates markdown with multiple series and chapters", () => {
		const annotations = [
			createAnnotation({
				id: 1,
				seriesId: 1,
				seriesName: "Book One",
				chapterId: 1,
				chapterTitle: "Chapter 1",
				selectedText: "First",
			}),
			createAnnotation({
				id: 2,
				seriesId: 1,
				seriesName: "Book One",
				chapterId: 2,
				chapterTitle: "Chapter 2",
				selectedText: "Second",
			}),
			createAnnotation({
				id: 3,
				seriesId: 2,
				seriesName: "Book Two",
				chapterId: 1,
				chapterTitle: "Introduction",
				selectedText: "Third",
			}),
		];

		const result = toMarkdown(annotations, defaultOptions);

		expect(result).toContain("## Book One");
		expect(result).toContain("## Book Two");
		expect(result).toContain("### Chapter 1");
		expect(result).toContain("### Chapter 2");
		expect(result).toContain("### Introduction");
		expect(result).toContain("> First");
		expect(result).toContain("> Second");
		expect(result).toContain("> Third");
	});

	it("filters spoilers based on options", () => {
		const annotations = [
			createAnnotation({
				id: 1,
				selectedText: "Normal",
				containsSpoiler: false,
			}),
			createAnnotation({
				id: 2,
				selectedText: "Secret",
				containsSpoiler: true,
			}),
		];

		const result = toMarkdown(annotations, defaultOptions);

		expect(result).toContain("> Normal");
		expect(result).not.toContain("> Secret");
	});

	it("respects includeTags option", () => {
		const annotations = [
			createAnnotation({
				seriesName: "Test Book",
				selectedText: "Highlight",
			}),
		];

		const resultWithTags = toMarkdown(annotations, defaultOptions);
		const resultWithoutTags = toMarkdown(annotations, {
			...defaultOptions,
			includeTags: false,
		});

		expect(resultWithTags).toContain("#kavita/series/test-book");
		expect(resultWithoutTags).not.toContain("#kavita/series/test-book");
	});

	it("respects includeWikilinks option", () => {
		const annotations = [
			createAnnotation({
				seriesName: "Test Book",
				selectedText: "Highlight",
			}),
		];

		const resultWithLinks = toMarkdown(annotations, defaultOptions);
		const resultWithoutLinks = toMarkdown(annotations, {
			...defaultOptions,
			includeWikilinks: false,
		});

		expect(resultWithLinks).toContain("[[Test Book]]");
		expect(resultWithoutLinks).not.toContain("[[Test Book]]");
	});

	it("includes author and genres from metadata map", () => {
		const annotations = [
			createAnnotation({
				seriesId: 42,
				seriesName: "The Great Gatsby",
				selectedText: "Highlight",
			}),
		];

		const metadataMap: SeriesMetadataMap = new Map([
			[
				42,
				createMetadata({
					seriesId: 42,
					writers: [{ id: 1, name: "F. Scott Fitzgerald", description: null }],
					genres: [{ id: 1, title: "Fiction" }],
				}),
			],
		]);

		const result = toMarkdown(annotations, defaultOptions, metadataMap);

		expect(result).toContain("**Author:** [[F. Scott Fitzgerald]]");
		expect(result).toContain("**Genres:** Fiction");
		expect(result).toContain("#kavita/author/f-scott-fitzgerald");
		expect(result).toContain("#kavita/genre/fiction");
	});

	it("handles missing metadata gracefully", () => {
		const annotations = [
			createAnnotation({
				seriesId: 99,
				seriesName: "Unknown Book",
				selectedText: "Highlight",
			}),
		];

		const metadataMap: SeriesMetadataMap = new Map();

		const result = toMarkdown(annotations, defaultOptions, metadataMap);

		expect(result).toContain("## Unknown Book");
		expect(result).not.toContain("**Author:**");
		expect(result).not.toContain("**Genres:**");
	});

	it("groups annotations by book title when chapterInfoMap is provided", () => {
		const annotations = [
			createAnnotation({
				id: 1,
				seriesId: 1,
				seriesName: "Horus Heresy",
				chapterId: 1,
				chapterTitle: "Chapter 1",
				selectedText: "First book highlight",
			}),
			createAnnotation({
				id: 2,
				seriesId: 1,
				seriesName: "Horus Heresy",
				chapterId: 2,
				chapterTitle: "Chapter 1",
				selectedText: "Second book highlight",
			}),
		];

		const chapterInfoMap: ChapterInfoMap = new Map([
			[1, { chapterId: 1, bookTitle: "Horus Rising", sortOrder: 1 }],
			[2, { chapterId: 2, bookTitle: "False Gods", sortOrder: 5 }],
		]);

		const result = toMarkdown(
			annotations,
			defaultOptions,
			undefined,
			chapterInfoMap,
		);

		expect(result).toContain("### Horus Rising");
		expect(result).toContain("### False Gods");
		expect(result).toContain("#kavita/book/horus-rising");
		expect(result).toContain("#kavita/book/false-gods");
	});

	it("falls back to series name when chapterInfoMap is not provided", () => {
		const annotations = [
			createAnnotation({
				seriesId: 1,
				seriesName: "Test Series",
				chapterId: 1,
				selectedText: "Highlight",
			}),
		];

		const result = toMarkdown(annotations, defaultOptions);

		expect(result).toContain("### Test Series");
		expect(result).toContain("#kavita/book/test-series");
	});
});

describe("getBookTitle", () => {
	it("returns book title from chapterInfoMap", () => {
		const annotation = createAnnotation({ chapterId: 1, seriesName: "Series" });
		const chapterInfoMap: ChapterInfoMap = new Map([
			[1, { chapterId: 1, bookTitle: "The Book Title", sortOrder: 1 }],
		]);

		expect(getBookTitle(annotation, chapterInfoMap)).toBe("The Book Title");
	});

	it("falls back to series name when chapter not in map", () => {
		const annotation = createAnnotation({
			chapterId: 99,
			seriesName: "Fallback Series",
		});
		const chapterInfoMap: ChapterInfoMap = new Map();

		expect(getBookTitle(annotation, chapterInfoMap)).toBe("Fallback Series");
	});

	it("falls back to series name when map is undefined", () => {
		const annotation = createAnnotation({ seriesName: "My Series" });

		expect(getBookTitle(annotation, undefined)).toBe("My Series");
	});
});

describe("groupByBookTitle", () => {
	it("groups annotations by book title", () => {
		const annotations = [
			createAnnotation({ id: 1, chapterId: 1 }),
			createAnnotation({ id: 2, chapterId: 2 }),
			createAnnotation({ id: 3, chapterId: 1 }),
		];

		const chapterInfoMap: ChapterInfoMap = new Map([
			[1, { chapterId: 1, bookTitle: "Book A", sortOrder: 1 }],
			[2, { chapterId: 2, bookTitle: "Book B", sortOrder: 2 }],
		]);

		const groups = groupByBookTitle(annotations, chapterInfoMap);

		expect(Object.keys(groups)).toHaveLength(2);
		expect(groups["Book A"]).toHaveLength(2);
		expect(groups["Book B"]).toHaveLength(1);
	});
});

describe("getSortedBookGroups", () => {
	it("sorts book groups by sortOrder", () => {
		const annotations = [
			createAnnotation({ id: 1, chapterId: 5 }),
			createAnnotation({ id: 2, chapterId: 1 }),
			createAnnotation({ id: 3, chapterId: 3 }),
		];

		const chapterInfoMap: ChapterInfoMap = new Map([
			[5, { chapterId: 5, bookTitle: "Fulgrim", sortOrder: 5 }],
			[1, { chapterId: 1, bookTitle: "Horus Rising", sortOrder: 1 }],
			[3, { chapterId: 3, bookTitle: "Galaxy in Flames", sortOrder: 3 }],
		]);

		const sorted = getSortedBookGroups(annotations, chapterInfoMap);

		expect(sorted[0]?.[0]).toBe("Horus Rising");
		expect(sorted[1]?.[0]).toBe("Galaxy in Flames");
		expect(sorted[2]?.[0]).toBe("Fulgrim");
	});

	it("handles missing chapterInfoMap gracefully", () => {
		const annotations = [createAnnotation({ id: 1, seriesName: "Test" })];

		const sorted = getSortedBookGroups(annotations, undefined);

		expect(sorted).toHaveLength(1);
		expect(sorted[0]?.[0]).toBe("Test");
	});
});

describe("getBookSortOrder", () => {
	it("returns sortOrder from chapterInfoMap", () => {
		const annotations = [createAnnotation({ chapterId: 1 })];
		const chapterInfoMap: ChapterInfoMap = new Map([
			[1, { chapterId: 1, bookTitle: "Book", sortOrder: 42 }],
		]);

		expect(getBookSortOrder("Book", annotations, chapterInfoMap)).toBe(42);
	});

	it("returns 0 when chapterInfoMap is undefined", () => {
		const annotations = [createAnnotation({ chapterId: 1 })];

		expect(getBookSortOrder("Book", annotations, undefined)).toBe(0);
	});

	it("returns 0 when chapter not in map", () => {
		const annotations = [createAnnotation({ chapterId: 99 })];
		const chapterInfoMap: ChapterInfoMap = new Map();

		expect(getBookSortOrder("Book", annotations, chapterInfoMap)).toBe(0);
	});
});

describe("generateBookHeader", () => {
	it("generates book header with title", () => {
		const lines = generateBookHeader("Test Book", defaultOptions);

		expect(lines).toContain("### Test Book");
	});

	it("includes wikilink when enabled", () => {
		const lines = generateBookHeader("Test Book", defaultOptions);

		expect(lines.some((l) => l.includes("[[Test Book]]"))).toBe(true);
	});

	it("includes book tag when tags enabled", () => {
		const lines = generateBookHeader("Test Book", defaultOptions);

		expect(lines.some((l) => l.includes("#kavita/book/test-book"))).toBe(true);
	});

	it("omits wikilink when disabled", () => {
		const lines = generateBookHeader("Test Book", {
			...defaultOptions,
			includeWikilinks: false,
		});

		expect(lines.some((l) => l.includes("[[Test Book]]"))).toBe(false);
	});

	it("omits tag when tags disabled", () => {
		const lines = generateBookHeader("Test Book", {
			...defaultOptions,
			includeTags: false,
		});

		expect(lines.some((l) => l.includes("#kavita/book"))).toBe(false);
	});
});
