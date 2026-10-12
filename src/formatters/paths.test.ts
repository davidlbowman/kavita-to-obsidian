/**
 * Tests for vault path sanitization.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
	buildBookPath,
	buildCoverPath,
	buildLibraryPath,
	buildSeriesPath,
	buildUniqueBookPath,
	COVERS_FOLDER,
	sanitizePathSegment,
} from "./paths.js";

const WINDOWS_RESERVED = [
	"CON",
	"prn",
	"Aux",
	"NUL",
	"COM1",
	"com9",
	"LPT1",
	"lpt9",
];

describe("sanitizePathSegment", () => {
	it.prop(
		"never yields forbidden characters, empty names, or over-long names",
		[Schema.String],
		([name]) => {
			const result = sanitizePathSegment(name);
			expect(result).not.toMatch(/[<>:"/\\|?*]/);
			expect(result.length).toBeGreaterThan(0);
			expect(result.length).toBeLessThanOrEqual(201);
			expect(result).not.toMatch(/\s{2,}/);
		},
	);

	it("replaces each forbidden character with a dash", () => {
		expect(sanitizePathSegment('a<b>c:d"e/f\\g|h?i*j')).toBe(
			"a-b-c-d-e-f-g-h-i-j",
		);
	});

	it("collapses and trims whitespace", () => {
		expect(sanitizePathSegment("  a \t\n b  ")).toBe("a b");
	});

	it("truncates to 200 characters", () => {
		expect(sanitizePathSegment("x".repeat(500))).toHaveLength(200);
	});

	it("names blank input Untitled", () => {
		expect(sanitizePathSegment("")).toBe("Untitled");
		expect(sanitizePathSegment("   ")).toBe("Untitled");
	});

	it("suffixes Windows reserved names", () => {
		for (const name of WINDOWS_RESERVED) {
			expect(sanitizePathSegment(name)).toBe(`${name}_`);
		}
		expect(sanitizePathSegment("CONSOLE")).toBe("CONSOLE");
	});
});

describe("buildBookPath / buildSeriesPath", () => {
	it("joins sanitized segments under the root", () => {
		expect(buildBookPath("Root", "What If?", "Q: One")).toBe(
			"Root/What If-/Q- One.md",
		);
		expect(buildSeriesPath("Root/", "A|B")).toBe("Root/A-B");
	});

	it.prop(
		"book paths sit inside their series folder",
		[Schema.String, Schema.String],
		([series, book]) => {
			const seriesPath = buildSeriesPath("Root", series);
			const bookPath = buildBookPath("Root", series, book);
			expect(bookPath.startsWith(`${seriesPath}/`)).toBe(true);
			expect(bookPath.endsWith(".md")).toBe(true);
			expect(bookPath.split("/")).toHaveLength(3);
		},
	);
});

describe("buildUniqueBookPath", () => {
	it.prop(
		"returns the base path when unused and appends the chapter id on collision",
		[Schema.String, Schema.String, Schema.Int],
		([series, book, chapterId]) => {
			const base = buildBookPath("Root", series, book);
			expect(
				buildUniqueBookPath("Root", series, book, chapterId, new Set()),
			).toBe(base);
			expect(
				buildUniqueBookPath("Root", series, book, chapterId, new Set([base])),
			).toBe(`${base.slice(0, -".md".length)} (ch-${chapterId}).md`);
		},
	);
});

describe("buildCoverPath", () => {
	it("files covers by chapter id in the covers folder", () => {
		expect(COVERS_FOLDER).toBe("Covers");
		expect(buildCoverPath("Kavita Annotations", 4, "png")).toBe(
			"Kavita Annotations/Covers/4.png",
		);
		expect(buildCoverPath("Books//", 12, "jpg")).toBe("Books/Covers/12.jpg");
	});
});

describe("buildLibraryPath", () => {
	it("puts the library base in the root folder", () => {
		expect(buildLibraryPath("Kavita Annotations")).toBe(
			"Kavita Annotations/Library.base",
		);
		expect(buildLibraryPath("Reading/Kavita/")).toBe(
			"Reading/Kavita/Library.base",
		);
	});
});
