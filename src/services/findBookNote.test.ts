/**
 * Tests for matching books to existing notes.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Book, BookNoteRef } from "../schemas.js";
import { findBookNote } from "./NoteSync.js";

const ADDED = "2026-01-01T00:00:00";

describe("findBookNote", () => {
	it.prop(
		"matches on chapter id and the date Kavita added the book",
		[Book, BookNoteRef],
		([book, note]) => {
			const b = { ...book, added: ADDED };
			const exact = { ...note, chapterId: b.chapterId, added: ADDED };
			assert.strictEqual(findBookNote([exact], new Set(), b), exact);
		},
	);

	it.prop(
		"never matches a reused chapter id from another library",
		[Book, BookNoteRef],
		([book, note]) => {
			const b = {
				...book,
				bookTitle: "Embers",
				seriesName: "The Lantern Cycle",
				added: ADDED,
			};
			const other = {
				...note,
				path: "Root/Other/Cinders.md",
				chapterId: b.chapterId,
				added: "2001-01-01T00:00:00",
				title: "Cinders",
			};
			assert.isUndefined(findBookNote([other], new Set(), b));
		},
	);

	it.prop(
		"adopts an older note by title in the book's series folder",
		[Book, BookNoteRef],
		([book, note]) => {
			const b = {
				...book,
				bookTitle: "What If? Questions: Answered",
				seriesName: "What If",
				added: ADDED,
			};
			const legacy = {
				...note,
				path: "Root/What If/What If- Questions- Answered (ch-7).md",
				chapterId: b.chapterId + 1,
				added: undefined,
				title: undefined,
			};
			assert.strictEqual(findBookNote([legacy], new Set(), b), legacy);
		},
	);

	it.prop(
		"skips notes already claimed this sync",
		[Book, BookNoteRef],
		([book, note]) => {
			const b = { ...book, added: ADDED };
			const exact = { ...note, chapterId: b.chapterId, added: ADDED };
			assert.isUndefined(findBookNote([exact], new Set([exact.path]), b));
		},
	);
});
