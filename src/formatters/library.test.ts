/**
 * Tests for the generated library base.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { Predicate } from "effect";
import { parse } from "yaml";
import { MANAGED_NOTE_KEY } from "./bookNote.js";
import { libraryBase } from "./library.js";

const field = (value: unknown, key: string): unknown =>
	Predicate.isObject(value) && key in value
		? Object.entries(value).find(([name]) => name === key)?.[1]
		: undefined;

describe("libraryBase", () => {
	it.each([
		"Kavita Annotations",
		"Books: Read #1",
		'Quotes "and" \\ slashes',
		"Ünïcode/Nested folder",
	])("filters notes in %s that carry the chapter id", (root) => {
		const base = parse(libraryBase(root));
		expect(field(field(base, "filters"), "and")).toEqual([
			`file.inFolder(${JSON.stringify(root)})`,
			`file.hasProperty("${MANAGED_NOTE_KEY}")`,
		]);
	});

	it("offers a cover card view and a grouped table", () => {
		const views = field(parse(libraryBase("Kavita Annotations")), "views");
		expect(views).toMatchObject([
			{ type: "cards", name: "Library", image: "note.cover" },
			{
				type: "table",
				name: "All books",
				groupBy: { property: "note.series", direction: "ASC" },
			},
		]);
	});
});
