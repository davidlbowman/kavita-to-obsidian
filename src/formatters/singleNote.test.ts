/**
 * Tests for the single-note layout.
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
import { byline } from "./bookNote.js";
import { SINGLE_NOTE_KEYS, singleNote, singleSection } from "./singleNote.js";

const BASE = new URL("https://kavita.example.com");
const options: FormatOptions = DEFAULT_SETTINGS;

const book = (
	base: Book,
	seriesName: string,
	seriesIndex: number,
	bookTitle: string,
	annotations: ReadonlyArray<Annotation>,
): Book => ({
	...base,
	seriesName,
	seriesIndex,
	bookTitle,
	authors: [],
	annotations,
});

const highlight = (base: Annotation, containsSpoiler: boolean): Annotation => ({
	...base,
	selectedText: "Quoted",
	chapterTitle: "Opening",
	pageNumber: 1,
	containsSpoiler,
});

describe("singleSection", () => {
	it("invites a first sync when there are no books", () => {
		expect(singleSection([], options, BASE)).toBe(
			"# Kavita highlights\n\n*No highlights yet. Highlight something in Kavita, then sync again.*",
		);
	});

	it.prop(
		"groups books by series in series and volume order",
		{ a: Book, b: Book, c: Book, h: Annotation },
		({ a, b, c, h }) => {
			const books = [
				book(a, "Beta", 2, "Beta Two", [highlight(h, false)]),
				book(b, "Alpha", 1, "Alpha One", []),
				book(c, "Beta", 1, "Beta One", []),
			];
			const section = singleSection(books, options, BASE);
			const order = [
				"## Alpha",
				"### Alpha One",
				"## Beta",
				"### Beta One",
				"### Beta Two",
			].map((heading) => section.indexOf(`${heading}\n`));
			expect(order.every((index) => index >= 0)).toBe(true);
			expect(order).toEqual([...order].sort((x, y) => x - y));
			expect(section.split("## Beta\n")).toHaveLength(2);
			expect(section).toContain("#### Opening\n\n> [!");
			expect(
				section.startsWith(
					"# Kavita highlights\n\n## Alpha\n\n### Alpha One\n\n",
				),
			).toBe(true);
			expect(section).toContain(
				`### Beta Two\n\n${byline(books[0] ?? a, options, BASE)}`,
			);
		},
	);
});

describe("singleNote", () => {
	it.prop(
		"counts books and visible highlights",
		{ a: Book, b: Book, h1: Annotation, h2: Annotation, h3: Annotation },
		({ a, b, h1, h2, h3 }) => {
			const books = [
				book(a, "S", 1, "One", [highlight(h1, false), highlight(h2, true)]),
				book(b, "S", 2, "Two", [highlight(h3, false)]),
			];
			const note = singleNote(books, options, BASE);
			expect(note.properties).toEqual({
				title: "Kavita highlights",
				books: 2,
				highlights: 2,
				tags: ["kavita"],
			});
			expect(note.ownedKeys).toBe(SINGLE_NOTE_KEYS);
			expect(note.section).toBe(singleSection(books, options, BASE));
			expect(note.isOwnedTag("kavita")).toBe(true);
			expect(note.isOwnedTag("series/s")).toBe(false);
			expect(
				singleNote(books, { ...options, includeSpoilers: true }, BASE)
					.properties.highlights,
			).toBe(3);
		},
	);

	it("writes no tags when they are off", () => {
		expect(
			singleNote([], { ...options, includeTags: false }, BASE).properties.tags,
		).toEqual([]);
	});
});
