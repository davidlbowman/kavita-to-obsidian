/**
 * Tests for markdown formatter functions.
 *
 * @module
 */
import { Option } from "effect";
import { describe, expect, it } from "vitest";
import type { AnnotationDto } from "../schemas.js";
import {
	formatAnnotation,
	groupByChapterId,
	groupBySeriesId,
	toMarkdown,
} from "./markdown.js";

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

describe("formatAnnotation", () => {
	it("formats basic annotation", () => {
		const annotation = createAnnotation({
			selectedText: "Hello world",
			pageNumber: 0,
		});
		const result = formatAnnotation(annotation, {
			includeComments: true,
			includeSpoilers: false,
		});

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
		const result = formatAnnotation(annotation, {
			includeComments: true,
			includeSpoilers: false,
		});

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
			includeComments: false,
			includeSpoilers: false,
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
		const result = formatAnnotation(annotation, {
			includeComments: true,
			includeSpoilers: false,
		});

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
		const result = formatAnnotation(annotation, {
			includeComments: true,
			includeSpoilers: false,
		});

		expect(Option.isNone(result)).toBe(true);
	});

	it("includes spoilers when enabled", () => {
		const annotation = createAnnotation({
			selectedText: "Spoiler",
			containsSpoiler: true,
		});
		const result = formatAnnotation(annotation, {
			includeComments: true,
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
		const result = toMarkdown([], {
			includeComments: true,
			includeSpoilers: false,
		});

		expect(result).toContain("# Kavita Annotations");
		expect(result).toContain("*No annotations found.*");
	});

	it("generates markdown with series and chapter grouping", () => {
		const annotations = [
			createAnnotation({
				id: 1,
				seriesId: 1,
				chapterId: 1,
				selectedText: "First",
			}),
			createAnnotation({
				id: 2,
				seriesId: 1,
				chapterId: 2,
				selectedText: "Second",
			}),
			createAnnotation({
				id: 3,
				seriesId: 2,
				chapterId: 1,
				selectedText: "Third",
			}),
		];

		const result = toMarkdown(annotations, {
			includeComments: true,
			includeSpoilers: false,
		});

		expect(result).toContain("# Kavita Annotations");
		expect(result).toContain("## Series 1");
		expect(result).toContain("## Series 2");
		expect(result).toContain("### Chapter 1");
		expect(result).toContain("### Chapter 2");
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

		const result = toMarkdown(annotations, {
			includeComments: true,
			includeSpoilers: false,
		});

		expect(result).toContain("> Normal");
		expect(result).not.toContain("> Secret");
	});
});
