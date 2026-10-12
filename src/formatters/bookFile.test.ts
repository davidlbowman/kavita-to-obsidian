/**
 * Tests for hierarchical-mode book notes.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import {
	Annotation,
	BookFile,
	DEFAULT_SETTINGS,
	type FormatOptions,
} from "../schemas.js";
import {
	formatBookFile,
	generateAnnotationsSection,
	generateBookFrontmatter,
	generateBookHeader,
	MANAGED_NOTE_KEY,
} from "./bookFile.js";

const UPDATED = "2024-05-06T07:08:09.000Z";

const options: FormatOptions = DEFAULT_SETTINGS;

describe("generateBookFrontmatter", () => {
	it.prop(
		"lists tags, Kavita IDs, the managed-note key, and the timestamp",
		{ book: BookFile },
		({ book }) => {
			const named = {
				...book,
				seriesName: "The Lantern Cycle",
				authors: ["Ada Lumen", "!!!"],
				genres: ["Science Fiction", "???"],
			};
			expect(generateBookFrontmatter(named, options, UPDATED)).toBe(
				[
					"---",
					"tags:",
					"  - kavita",
					"  - series/the-lantern-cycle",
					"  - author/ada-lumen",
					"  - genre/science-fiction",
					`kavita_series_id: ${book.seriesId}`,
					`${MANAGED_NOTE_KEY}: ${book.chapterId}`,
					`updated: ${UPDATED}`,
					"---",
				].join("\n"),
			);
		},
	);

	it.prop(
		"uses the tag prefix for genres and skips unsluggable series",
		{ book: BookFile },
		({ book }) => {
			const result = generateBookFrontmatter(
				{ ...book, seriesName: "???", authors: [], genres: ["Fantasy"] },
				{ ...options, tagPrefix: "reading/" },
				UPDATED,
			);
			expect(result).toContain("tags:\n  - kavita\n  - reading/fantasy\n");
			expect(result).not.toContain("series/");
		},
	);
});

describe("generateBookHeader", () => {
	it.prop(
		"links series and authors when wikilinks are on",
		{ book: BookFile },
		({ book }) => {
			const named = {
				...book,
				bookTitle: "Embers",
				seriesName: "Lantern",
				authors: ["Ada", "Bram"],
				genres: ["Fantasy"],
			};
			expect(generateBookHeader(named, options)).toBe(
				"# Embers\n\n**Series:** [[Lantern]]\n**Author:** [[Ada]], [[Bram]]\n**Genres:** Fantasy\n\n---\n",
			);
			expect(
				generateBookHeader(named, { ...options, includeWikilinks: false }),
			).toBe(
				"# Embers\n\n**Series:** Lantern\n**Author:** Ada, Bram\n**Genres:** Fantasy\n\n---\n",
			);
		},
	);

	it.prop(
		"omits author and genre lines when empty",
		{ book: BookFile },
		({ book }) => {
			expect(
				generateBookHeader(
					{
						...book,
						bookTitle: "Embers",
						seriesName: "Lantern",
						authors: [],
						genres: [],
					},
					options,
				),
			).toBe("# Embers\n\n**Series:** [[Lantern]]\n\n---\n");
		},
	);
});

describe("generateAnnotationsSection", () => {
	it("says so when there are no annotations", () => {
		expect(generateAnnotationsSection([], options)).toBe(
			"## Annotations\n\n*No annotations yet.*",
		);
	});

	it.prop(
		"renders visible annotations separated by rules",
		{ a: Annotation, b: Annotation },
		({ a, b }) => {
			const visible = {
				...a,
				containsSpoiler: false,
				selectedText: "kept",
				commentPlainText: null,
				commentHtml: null,
				comment: null,
				pageNumber: 0,
			};
			const spoiler = { ...b, containsSpoiler: true };
			expect(generateAnnotationsSection([visible, spoiler], options)).toBe(
				"## Annotations\n\n> kept\n\n---\n",
			);
		},
	);
});

describe("formatBookFile", () => {
	it.prop(
		"joins frontmatter, header, and annotations",
		{ book: BookFile },
		({ book }) => {
			expect(formatBookFile(book, options, UPDATED)).toBe(
				[
					generateBookFrontmatter(book, options, UPDATED),
					"",
					generateBookHeader(book, options),
					generateAnnotationsSection(book.annotations, options),
				].join("\n"),
			);
		},
	);
});
