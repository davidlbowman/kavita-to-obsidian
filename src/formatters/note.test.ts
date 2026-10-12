/**
 * Tests for merging synced content into notes without touching user edits.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { parse } from "yaml";
import { Book, DEFAULT_SETTINGS } from "../schemas.js";
import { bookNote } from "./bookNote.js";
import {
	mergeNote,
	type NoteContent,
	SECTION_END,
	SECTION_START,
	splitNote,
	syncedHighlightIds,
} from "./note.js";

const BASE = new URL("https://kavita.example.com");

const content: NoteContent = {
	properties: { title: "Embers", kavita_chapter_id: 5, tags: ["kavita"] },
	ownedKeys: ["title", "kavita_chapter_id", "updated"],
	isOwnedTag: (tag) => tag === "kavita" || tag.startsWith("series/"),
	section: "## The Spark\n\nHighlight text",
};

const frontmatterOf = (note: string): unknown =>
	parse(/^---\n([\s\S]*?)\n---/.exec(note)?.[1] ?? "");

const fresh = [
	"---",
	"title: Embers",
	"kavita_chapter_id: 5",
	"tags:",
	"  - kavita",
	"---",
	"",
	SECTION_START,
	"",
	"## The Spark",
	"",
	"Highlight text",
	"",
	SECTION_END,
	"",
].join("\n");

describe("splitNote", () => {
	it("reads a note without frontmatter as all body", () => {
		expect(splitNote("# Just a note\n")).toEqual({
			frontmatter: {},
			body: "# Just a note\n",
		});
	});

	it("parses frontmatter and returns the rest as body", () => {
		expect(splitNote("---\nrating: 5\n---\nBody\n")).toEqual({
			frontmatter: { rating: 5 },
			body: "Body\n",
		});
	});

	it("handles Windows line endings", () => {
		expect(splitNote("---\r\nrating: 5\r\n---\r\nBody")).toEqual({
			frontmatter: { rating: 5 },
			body: "Body",
		});
	});

	it("reads invalid or non-mapping YAML as empty frontmatter", () => {
		expect(splitNote("---\nkey: [unclosed\n---\nBody")).toEqual({
			frontmatter: {},
			body: "Body",
		});
		expect(splitNote("---\njust text\n---\nBody")).toEqual({
			frontmatter: {},
			body: "Body",
		});
	});
});

describe("mergeNote", () => {
	it("writes a new note as frontmatter plus the marked section", () => {
		expect(mergeNote(undefined, content)).toBe(fresh);
	});

	it("keeps user text around the section byte for byte", () => {
		const existing = [
			"---",
			"title: Old",
			"---",
			"",
			"My intro, *with* formatting.",
			"",
			SECTION_START,
			"",
			"old highlights",
			"",
			SECTION_END,
			"",
			"## My thoughts",
			"",
			"- keep me",
			"",
		].join("\n");
		const merged = mergeNote(existing, content);
		expect(merged).toContain(
			`\n\nMy intro, *with* formatting.\n\n${SECTION_START}\n\n## The Spark\n\nHighlight text\n\n${SECTION_END}\n\n## My thoughts\n\n- keep me\n`,
		);
		expect(merged.endsWith("- keep me\n")).toBe(true);
		expect(merged).not.toContain("old highlights");
	});

	it("keeps user properties and tags, replacing only owned ones", () => {
		const existing = [
			"---",
			"title: Old",
			"rating: 5",
			"updated: 2020-01-01",
			"tags:",
			"  - kavita",
			"  - series/old",
			"  - to-read",
			"status: reading",
			"---",
			"",
			SECTION_START,
			SECTION_END,
			"",
		].join("\n");
		expect(frontmatterOf(mergeNote(existing, content))).toEqual({
			title: "Embers",
			kavita_chapter_id: 5,
			tags: ["kavita", "to-read"],
			rating: 5,
			status: "reading",
		});
	});

	it("accepts a single tag written as a string", () => {
		const existing = "---\ntags: mine\n---\n";
		expect(frontmatterOf(mergeNote(existing, content))).toMatchObject({
			tags: ["kavita", "mine"],
		});
	});

	it("drops the tags property when nothing is left", () => {
		const merged = mergeNote("---\ntags:\n  - kavita\n---\n", {
			...content,
			properties: { title: "Embers" },
		});
		expect(frontmatterOf(merged)).toEqual({ title: "Embers" });
	});

	it("ends with a newline when the end marker closes the file", () => {
		const existing = `---\ntitle: x\n---\n\nIntro\n\n${SECTION_START}\nold\n${SECTION_END}`;
		expect(
			mergeNote(existing, content).endsWith(
				`Highlight text\n\n${SECTION_END}\n`,
			),
		).toBe(true);
	});

	it("replaces the whole body of notes written before the markers", () => {
		const existing =
			"---\nkavita_chapter_id: 5\nupdated: 2024-01-01\n---\n\n# Embers\n\nOld generated body\n";
		expect(mergeNote(existing, content)).toBe(fresh);
	});

	it("replaces the body when the markers are out of order", () => {
		const existing = `---\ntitle: x\n---\n\n${SECTION_END}\n\nstuff\n\n${SECTION_START}\n`;
		expect(mergeNote(existing, content)).toBe(fresh);
	});

	it("recognizes the start marker regardless of its explanatory text", () => {
		const existing = `---\ntitle: x\n---\n\nIntro\n\n%% kavita-sync:start %%\nold\n${SECTION_END}\n`;
		expect(mergeNote(existing, content)).toContain(
			`Intro\n\n${SECTION_START}\n\n## The Spark`,
		);
	});

	it.prop(
		"is idempotent for book notes",
		[Book],
		([book]) => {
			const note = bookNote(book, DEFAULT_SETTINGS, BASE, undefined);
			if (note.section.includes("%%")) return;
			const once = mergeNote(undefined, note);
			expect(mergeNote(once, note)).toBe(once);
		},
		{ arbitrary: { runs: 50 } },
	);
});

describe("syncedHighlightIds", () => {
	it("finds block ids on their own lines only", () => {
		expect(
			syncedHighlightIds(
				"> quote\n\n^kavita-1\n\n> another\n\n^kavita-22\n\ninline ^kavita-3\n^kavita-x\n",
			),
		).toEqual(new Set([1, 22]));
	});

	it.prop(
		"recovers the ids of a rendered book note",
		[Book],
		([book]) => {
			const rendered = mergeNote(
				undefined,
				bookNote(
					book,
					{ ...DEFAULT_SETTINGS, includeSpoilers: true },
					BASE,
					undefined,
				),
			);
			const visible = book.annotations.filter(
				(a) => a.id >= 0 && (a.selectedText ?? "").trim() !== "",
			);
			for (const annotation of visible) {
				expect(syncedHighlightIds(rendered).has(annotation.id)).toBe(true);
			}
		},
		{ arbitrary: { runs: 50 } },
	);
});
