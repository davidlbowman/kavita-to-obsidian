/**
 * Tests for path sanitization utilities.
 *
 * @module
 */
import { describe, expect, it } from "vitest";
import {
	buildBookPath,
	buildSeriesPath,
	buildUniqueBookPath,
	sanitizePathSegment,
} from "./paths.js";

describe("sanitizePathSegment", () => {
	it("replaces invalid characters with dashes", () => {
		expect(sanitizePathSegment("Book: Part 1")).toBe("Book- Part 1");
		expect(sanitizePathSegment("A/B\\C")).toBe("A-B-C");
		expect(sanitizePathSegment("What?")).toBe("What-");
		expect(sanitizePathSegment('Say "Hello"')).toBe("Say -Hello-");
		expect(sanitizePathSegment("File<>Name")).toBe("File--Name");
		expect(sanitizePathSegment("Pipe|Here")).toBe("Pipe-Here");
		expect(sanitizePathSegment("Star*Path")).toBe("Star-Path");
	});

	it("normalizes whitespace", () => {
		expect(sanitizePathSegment("Too   Many   Spaces")).toBe("Too Many Spaces");
		expect(sanitizePathSegment("  Leading")).toBe("Leading");
		expect(sanitizePathSegment("Trailing  ")).toBe("Trailing");
		expect(sanitizePathSegment("Tab\there")).toBe("Tab here");
	});

	it("truncates long names", () => {
		const longName = "A".repeat(250);
		const result = sanitizePathSegment(longName);
		expect(result.length).toBe(200);
	});

	it("handles empty strings", () => {
		expect(sanitizePathSegment("")).toBe("Untitled");
		expect(sanitizePathSegment("   ")).toBe("Untitled");
	});

	it("handles Windows reserved names", () => {
		expect(sanitizePathSegment("CON")).toBe("CON_");
		expect(sanitizePathSegment("con")).toBe("con_");
		expect(sanitizePathSegment("PRN")).toBe("PRN_");
		expect(sanitizePathSegment("AUX")).toBe("AUX_");
		expect(sanitizePathSegment("NUL")).toBe("NUL_");
		expect(sanitizePathSegment("COM1")).toBe("COM1_");
		expect(sanitizePathSegment("LPT9")).toBe("LPT9_");
	});

	it("leaves normal names unchanged", () => {
		expect(sanitizePathSegment("The Last Wish")).toBe("The Last Wish");
		expect(sanitizePathSegment("Book-1")).toBe("Book-1");
		expect(sanitizePathSegment("Chapter_One")).toBe("Chapter_One");
	});
});

describe("buildBookPath", () => {
	it("builds correct path from components", () => {
		const result = buildBookPath(
			"Kavita Annotations",
			"The Witcher",
			"The Last Wish",
		);
		expect(result).toBe("Kavita Annotations/The Witcher/The Last Wish.md");
	});

	it("sanitizes series and book names", () => {
		const result = buildBookPath(
			"Kavita Annotations",
			"Series: Part 1",
			"Book/Chapter 1",
		);
		expect(result).toBe("Kavita Annotations/Series- Part 1/Book-Chapter 1.md");
	});
});

describe("buildSeriesPath", () => {
	it("builds correct series folder path", () => {
		const result = buildSeriesPath("Kavita Annotations", "The Witcher");
		expect(result).toBe("Kavita Annotations/The Witcher");
	});

	it("sanitizes series name", () => {
		const result = buildSeriesPath("Root", "Series: Special");
		expect(result).toBe("Root/Series- Special");
	});
});

describe("buildUniqueBookPath", () => {
	it("returns base path when no conflict", () => {
		const existing = new Set<string>();
		const result = buildUniqueBookPath("Root", "Series", "Book", 123, existing);
		expect(result).toBe("Root/Series/Book.md");
	});

	it("appends chapter ID when path exists", () => {
		const existing = new Set(["Root/Series/Book.md"]);
		const result = buildUniqueBookPath("Root", "Series", "Book", 123, existing);
		expect(result).toBe("Root/Series/Book (ch-123).md");
	});

	it("handles multiple duplicates", () => {
		const existing = new Set([
			"Root/Series/Introduction.md",
			"Root/Series/Introduction (ch-100).md",
		]);

		const result1 = buildUniqueBookPath(
			"Root",
			"Series",
			"Introduction",
			100,
			existing,
		);
		expect(result1).toBe("Root/Series/Introduction (ch-100).md");

		const result2 = buildUniqueBookPath(
			"Root",
			"Series",
			"Introduction",
			200,
			existing,
		);
		expect(result2).toBe("Root/Series/Introduction (ch-200).md");
	});
});
