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
	chapterId: 1,
	content: "Test highlight",
	spoiler: false,
	highlightSlot: 0,
	...overrides,
});

describe("formatAnnotation", () => {
	it("formats basic annotation", () => {
		const annotation = createAnnotation({ content: "Hello world" });
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
			content: "Highlight",
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
			content: "Highlight",
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
		const annotation = createAnnotation({ content: "Highlight", page: 42 });
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
		const annotation = createAnnotation({ content: "Spoiler", spoiler: true });
		const result = formatAnnotation(annotation, {
			includeComments: true,
			includeSpoilers: false,
		});

		expect(Option.isNone(result)).toBe(true);
	});

	it("includes spoilers when enabled", () => {
		const annotation = createAnnotation({ content: "Spoiler", spoiler: true });
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

		expect(groups.size).toBe(2);
		expect(groups.get(1)?.length).toBe(2);
		expect(groups.get(2)?.length).toBe(1);
	});

	it("handles undefined seriesId", () => {
		const annotations = [
			createAnnotation({ id: 1, seriesId: undefined }),
			createAnnotation({ id: 2, seriesId: 1 }),
		];

		const groups = groupBySeriesId(annotations);

		expect(groups.size).toBe(2);
		expect(groups.get(undefined)?.length).toBe(1);
		expect(groups.get(1)?.length).toBe(1);
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

		expect(groups.size).toBe(2);
		expect(groups.get(1)?.length).toBe(2);
		expect(groups.get(2)?.length).toBe(1);
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
			createAnnotation({ id: 1, seriesId: 1, chapterId: 1, content: "First" }),
			createAnnotation({ id: 2, seriesId: 1, chapterId: 2, content: "Second" }),
			createAnnotation({ id: 3, seriesId: 2, chapterId: 1, content: "Third" }),
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
			createAnnotation({ id: 1, content: "Normal", spoiler: false }),
			createAnnotation({ id: 2, content: "Secret", spoiler: true }),
		];

		const result = toMarkdown(annotations, {
			includeComments: true,
			includeSpoilers: false,
		});

		expect(result).toContain("> Normal");
		expect(result).not.toContain("> Secret");
	});
});
