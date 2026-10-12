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
	MY_NOTES_HEADING,
	type NoteContent,
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
	"## The Spark",
	"",
	"Highlight text",
	"",
	MY_NOTES_HEADING,
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
	it("writes a new note as frontmatter, the section, and My notes", () => {
		expect(mergeNote(undefined, content)).toBe(fresh);
	});

	it("keeps everything under My notes byte for byte", () => {
		const existing = [
			"---",
			"title: Old",
			"---",
			"",
			"old highlights",
			"",
			MY_NOTES_HEADING,
			"",
			"My thoughts, *with* formatting.",
			"",
			"### Quotes I love",
			"",
			"- keep me",
			"",
		].join("\n");
		const merged = mergeNote(existing, content);
		expect(merged).toContain(
			`## The Spark\n\nHighlight text\n\n${MY_NOTES_HEADING}\n\nMy thoughts, *with* formatting.\n\n### Quotes I love\n\n- keep me\n`,
		);
		expect(merged.endsWith("- keep me\n")).toBe(true);
		expect(merged).not.toContain("old highlights");
	});

	it("uses the last My notes heading as the boundary", () => {
		const existing = `---\ntitle: x\n---\n\n## My notes\n\nold chapter\n\n${MY_NOTES_HEADING}\n\nmine\n`;
		const merged = mergeNote(existing, content);
		expect(merged).toContain(`Highlight text\n\n${MY_NOTES_HEADING}\n\nmine\n`);
		expect(merged).not.toContain("old chapter");
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
			MY_NOTES_HEADING,
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

	it("ends with exactly one newline", () => {
		const existing = `---\ntitle: x\n---\n\nold\n\n${MY_NOTES_HEADING}\n\nmine\n\n\n`;
		expect(mergeNote(existing, content).endsWith("mine\n")).toBe(true);
	});

	it("replaces the whole body of notes from older versions", () => {
		const existing =
			"---\nkavita_chapter_id: 5\nupdated: 2024-01-01\n---\n\n# Embers\n\nOld generated body\n";
		expect(mergeNote(existing, content)).toBe(fresh);
	});

	it.prop(
		"is idempotent for book notes",
		[Book],
		([book]) => {
			const note = bookNote(book, DEFAULT_SETTINGS, BASE, undefined);
			const once = mergeNote(undefined, note);
			expect(mergeNote(once, note)).toBe(once);
		},
		{ arbitrary: { runs: 50 } },
	);
});

describe("syncedHighlightIds", () => {
	it("finds annotation ids in links back to Kavita", () => {
		expect(
			syncedHighlightIds(
				"> [!kavita-cyan] [Page 1](https://k/book/2?annotation=1)\n[x](https://k/book/2?a=b&annotation=22) annotation=3 ?annotation=x",
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
