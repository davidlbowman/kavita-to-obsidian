/**
 * Tests for book file formatter.
 *
 * @module
 */

import { Option } from "effect";
import { describe, expect, it } from "vitest";
import type { AnnotationDto } from "../schemas.js";
import {
	type BookFileOptions,
	formatBookAnnotation,
	formatBookFile,
	generateAnnotationsSection,
	generateBookFrontmatter,
	generateBookHeader,
} from "./bookFile.js";
import type { FormatOptions } from "./markdown.js";

const createAnnotation = (
	overrides: Partial<typeof AnnotationDto.Type> = {},
): typeof AnnotationDto.Type =>
	({
		id: 1,
		xPath: "/html/body/p[1]",
		endingXPath: null,
		selectedText: "This is highlighted text",
		comment: "My note",
		commentHtml: null,
		commentPlainText: null,
		chapterTitle: "Chapter 1",
		context: null,
		highlightCount: 23,
		containsSpoiler: false,
		pageNumber: 42,
		selectedSlotIndex: 0,
		likes: [],
		seriesName: "Test Series",
		libraryName: "Books",
		chapterId: 10,
		volumeId: 1,
		seriesId: 100,
		libraryId: 1,
		ownerUserId: 1,
		ownerUsername: "user",
		ageRating: 0,
		createdUtc: "2024-01-01T00:00:00Z",
		lastModifiedUtc: "2024-01-01T00:00:00Z",
		...overrides,
	}) as typeof AnnotationDto.Type;

const defaultFormatOptions: FormatOptions = {
	includeComments: true,
	includeSpoilers: false,
	includeTags: true,
	tagPrefix: "",
	includeWikilinks: true,
};

const createBookOptions = (
	overrides: Partial<BookFileOptions> = {},
): BookFileOptions => ({
	bookTitle: "The Last Wish",
	seriesName: "The Witcher",
	seriesId: 100,
	chapterId: 10,
	authors: ["Andrzej Sapkowski"],
	genres: ["Fantasy", "Adventure"],
	annotations: [createAnnotation()],
	formatOptions: defaultFormatOptions,
	...overrides,
});

describe("generateBookFrontmatter", () => {
	it("generates frontmatter with tags", () => {
		const options = createBookOptions();
		const result = generateBookFrontmatter(options);

		expect(result).toContain("---");
		expect(result).toContain("tags:");
		expect(result).toContain("  - kavita");
		expect(result).toContain("  - series/the-witcher");
		expect(result).toContain("  - author/andrzej-sapkowski");
		expect(result).toContain("  - genre/fantasy");
		expect(result).toContain("  - genre/adventure");
		expect(result).toContain("kavita_series_id: 100");
		expect(result).toContain("kavita_chapter_id: 10");
		expect(result).toContain("updated:");
	});

	it("uses tag prefix for genres when provided", () => {
		const options = createBookOptions({
			formatOptions: { ...defaultFormatOptions, tagPrefix: "reading/" },
		});
		const result = generateBookFrontmatter(options);

		expect(result).toContain("  - reading/fantasy");
		expect(result).toContain("  - reading/adventure");
	});

	it("handles multiple authors", () => {
		const options = createBookOptions({
			authors: ["Author One", "Author Two"],
		});
		const result = generateBookFrontmatter(options);

		expect(result).toContain("  - author/author-one");
		expect(result).toContain("  - author/author-two");
	});

	it("handles empty authors and genres", () => {
		const options = createBookOptions({
			authors: [],
			genres: [],
		});
		const result = generateBookFrontmatter(options);

		expect(result).toContain("  - kavita");
		expect(result).toContain("  - series/the-witcher");
		expect(result).not.toContain("author/");
		expect(result).not.toContain("genre/");
	});
});

describe("generateBookHeader", () => {
	it("generates header with wikilinks", () => {
		const options = createBookOptions();
		const result = generateBookHeader(options);

		expect(result).toContain("# The Last Wish");
		expect(result).toContain("**Series:** [[The Witcher]]");
		expect(result).toContain("**Author:** [[Andrzej Sapkowski]]");
		expect(result).toContain("**Genres:** Fantasy, Adventure");
	});

	it("generates header without wikilinks when disabled", () => {
		const options = createBookOptions({
			formatOptions: { ...defaultFormatOptions, includeWikilinks: false },
		});
		const result = generateBookHeader(options);

		expect(result).toContain("**Series:** The Witcher");
		expect(result).toContain("**Author:** Andrzej Sapkowski");
		expect(result).not.toContain("[[");
	});

	it("handles multiple authors with wikilinks", () => {
		const options = createBookOptions({
			authors: ["Author One", "Author Two"],
		});
		const result = generateBookHeader(options);

		expect(result).toContain("**Author:** [[Author One]], [[Author Two]]");
	});

	it("omits author line when no authors", () => {
		const options = createBookOptions({ authors: [] });
		const result = generateBookHeader(options);

		expect(result).not.toContain("**Author:**");
	});

	it("omits genres line when no genres", () => {
		const options = createBookOptions({ genres: [] });
		const result = generateBookHeader(options);

		expect(result).not.toContain("**Genres:**");
	});
});

describe("formatBookAnnotation", () => {
	it("formats annotation with comment and page", () => {
		const annotation = createAnnotation();
		const result = formatBookAnnotation(annotation, defaultFormatOptions);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toContain("> This is highlighted text");
			expect(result.value).toContain("*Note:* My note");
			expect(result.value).toContain("<small>Page 42</small>");
		}
	});

	it("uses commentPlainText when available", () => {
		const annotation = createAnnotation({
			comment: '{"ops":[{"insert":"JSON note\n"}]}',
			commentPlainText: "Plain text note",
		});
		const result = formatBookAnnotation(annotation, defaultFormatOptions);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toContain("*Note:* Plain text note");
			expect(result.value).not.toContain("JSON note");
		}
	});

	it("extracts text from Quill Delta JSON when commentPlainText is not available", () => {
		const annotation = createAnnotation({
			comment: '{"ops":[{"insert":"Just testing annotations\\n"}]}',
			commentPlainText: null,
		});
		const result = formatBookAnnotation(annotation, defaultFormatOptions);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toContain("*Note:* Just testing annotations");
			expect(result.value).not.toContain('{"ops"');
		}
	});

	it("falls back to plain comment when Quill Delta parsing fails", () => {
		const annotation = createAnnotation({
			comment: "Plain text comment",
			commentPlainText: null,
		});
		const result = formatBookAnnotation(annotation, defaultFormatOptions);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toContain("*Note:* Plain text comment");
		}
	});

	it("excludes comment when disabled", () => {
		const annotation = createAnnotation();
		const options = { ...defaultFormatOptions, includeComments: false };
		const result = formatBookAnnotation(annotation, options);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).not.toContain("*Note:*");
		}
	});

	it("filters spoilers when disabled", () => {
		const annotation = createAnnotation({ containsSpoiler: true });
		const result = formatBookAnnotation(annotation, defaultFormatOptions);

		expect(Option.isNone(result)).toBe(true);
	});

	it("includes spoilers when enabled", () => {
		const annotation = createAnnotation({ containsSpoiler: true });
		const options = { ...defaultFormatOptions, includeSpoilers: true };
		const result = formatBookAnnotation(annotation, options);

		expect(Option.isSome(result)).toBe(true);
	});

	it("handles multiline text", () => {
		const annotation = createAnnotation({
			selectedText: "Line one\nLine two\nLine three",
		});
		const result = formatBookAnnotation(annotation, defaultFormatOptions);

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value).toContain("> Line one\n> Line two\n> Line three");
		}
	});
});

describe("generateAnnotationsSection", () => {
	it("generates section with annotations", () => {
		const annotations = [
			createAnnotation({ id: 1, selectedText: "First highlight" }),
			createAnnotation({ id: 2, selectedText: "Second highlight" }),
		];
		const result = generateAnnotationsSection(
			annotations,
			defaultFormatOptions,
		);

		expect(result).toContain("## Annotations");
		expect(result).toContain("> First highlight");
		expect(result).toContain("> Second highlight");
		expect(result).toContain("---");
	});

	it("shows empty message when no annotations", () => {
		const result = generateAnnotationsSection([], defaultFormatOptions);

		expect(result).toContain("## Annotations");
		expect(result).toContain("*No annotations yet.*");
	});

	it("filters out spoilers", () => {
		const annotations = [
			createAnnotation({
				id: 1,
				selectedText: "Normal",
				containsSpoiler: false,
			}),
			createAnnotation({
				id: 2,
				selectedText: "Spoiler",
				containsSpoiler: true,
			}),
		];
		const result = generateAnnotationsSection(
			annotations,
			defaultFormatOptions,
		);

		expect(result).toContain("> Normal");
		expect(result).not.toContain("> Spoiler");
	});
});

describe("formatBookFile", () => {
	it("generates complete book file", () => {
		const options = createBookOptions();
		const result = formatBookFile(options);

		expect(result).toContain("---");
		expect(result).toContain("tags:");
		expect(result).toContain("# The Last Wish");
		expect(result).toContain("**Series:** [[The Witcher]]");
		expect(result).toContain("## Annotations");
		expect(result).toContain("> This is highlighted text");
	});

	it("generates file with no annotations", () => {
		const options = createBookOptions({ annotations: [] });
		const result = formatBookFile(options);

		expect(result).toContain("# The Last Wish");
		expect(result).toContain("*No annotations yet.*");
	});
});
