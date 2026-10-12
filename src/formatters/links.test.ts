/**
 * Tests for links back into Kavita's reader.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { Annotation } from "../schemas.js";
import { annotationUrl, bookUrl } from "./links.js";

describe("bookUrl", () => {
	it.each([
		["https://kavita.example.com", "https://kavita.example.com/"],
		["https://kavita.example.com/", "https://kavita.example.com/"],
		["http://host:5000/kavita", "http://host:5000/kavita/"],
		["http://host:5000/kavita/", "http://host:5000/kavita/"],
	])("joins the reader path onto %s", (base, prefix) => {
		expect(
			bookUrl(new URL(base), { libraryId: 1, seriesId: 3, chapterId: 4 }),
		).toBe(`${prefix}library/1/series/3/book/4`);
	});
});

describe("annotationUrl", () => {
	it.prop(
		"opens the book scrolled to the highlight",
		[Annotation],
		([annotation]) => {
			const base = new URL("http://host/kavita");
			const url = new URL(annotationUrl(base, annotation));
			expect(url.pathname).toBe(
				`/kavita/library/${annotation.libraryId}/series/${annotation.seriesId}/book/${annotation.chapterId}`,
			);
			expect(url.searchParams.get("annotation")).toBe(String(annotation.id));
		},
	);
});
