/**
 * The fixture library seeded into Kavita for live integration tests.
 *
 * Each book carries the annotations the harness creates against it, so the
 * expected vault output can be asserted from the same source of truth.
 *
 * @module
 */
import type { EpubBook } from "./epub.js";

/**
 * An annotation the harness creates on a fixture chapter.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export interface FixtureAnnotation {
	readonly chapterIndex: number;
	readonly selectedText: string;
	readonly comment: string | null;
	readonly containsSpoiler: boolean;
	readonly slot: number;
}

/**
 * A fixture book: its EPUB contents, folder on disk, and annotations.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export interface FixtureBook {
	readonly folder: string;
	readonly fileName: string;
	readonly book: EpubBook;
	readonly annotations: ReadonlyArray<FixtureAnnotation>;
}

/**
 * Every book in the fixture library.
 *
 * Covers multi-book series, multiple authors, punctuation that must be
 * sanitized out of vault paths, spoilers, missing comments, HTML-significant
 * characters, and non-ASCII text. "Scratch Pad" starts unannotated so tests
 * can create and delete annotations on it.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export const FIXTURE_LIBRARY: ReadonlyArray<FixtureBook> = [
	{
		folder: "The Lantern Cycle",
		fileName: "The Lantern Cycle - Vol. 1 - Embers.epub",
		book: {
			id: "8f3c0a52-1f0e-4b1e-9d55-0c2d7c1a0001",
			title: "Embers",
			coverColor: [201, 92, 54],
			authors: ["Ada Lumen"],
			subjects: ["Fantasy", "Adventure"],
			series: "The Lantern Cycle",
			seriesIndex: 1,
			chapters: [
				{
					title: "The Spark",
					paragraphs: [
						"Every fire begins as a single spark in the dark.",
						"The lantern-keeper counted the flames twice each night.",
					],
				},
				{
					title: "Ash & Iron",
					paragraphs: [
						"Iron remembers the shape of the fire that made it.",
						"She learned the keeper's name only at the very end.",
					],
				},
			],
		},
		annotations: [
			{
				chapterIndex: 0,
				selectedText: "Every fire begins as a single spark in the dark.",
				comment: "Opening line, sets the motif",
				containsSpoiler: false,
				slot: 0,
			},
			{
				chapterIndex: 0,
				selectedText: "The lantern-keeper counted the flames twice each night.",
				comment: null,
				containsSpoiler: false,
				slot: 2,
			},
			{
				chapterIndex: 1,
				selectedText: "She learned the keeper's name only at the very end.",
				comment: "Big reveal",
				containsSpoiler: true,
				slot: 4,
			},
		],
	},
	{
		folder: "The Lantern Cycle",
		fileName: "The Lantern Cycle - Vol. 2 - Cinders.epub",
		book: {
			id: "8f3c0a52-1f0e-4b1e-9d55-0c2d7c1a0002",
			title: "Cinders",
			coverColor: [88, 96, 112],
			authors: ["Ada Lumen", "Bram Coal"],
			subjects: ["Fantasy"],
			series: "The Lantern Cycle",
			seriesIndex: 2,
			chapters: [
				{
					title: "Cold Hearth",
					paragraphs: [
						'"Fire < Faith > Fear," read the inscription above the hearth.',
						"Café owners along the río kept the embers alive.",
					],
				},
			],
		},
		annotations: [
			{
				chapterIndex: 0,
				selectedText:
					'"Fire < Faith > Fear," read the inscription above the hearth.',
				comment: "Angle brackets & quotes must survive",
				containsSpoiler: false,
				slot: 1,
			},
			{
				chapterIndex: 0,
				selectedText: "Café owners along the río kept the embers alive.",
				comment: "Unicode check",
				containsSpoiler: false,
				slot: 3,
			},
		],
	},
	{
		folder: "What If? Questions: Answered",
		fileName: "What If? Questions: Answered.epub",
		book: {
			id: "8f3c0a52-1f0e-4b1e-9d55-0c2d7c1a0003",
			title: "What If? Questions: Answered",
			coverColor: [46, 110, 160],
			authors: ["Cy Query"],
			subjects: ["Science"],
			series: "What If? Questions: Answered",
			seriesIndex: 1,
			chapters: [
				{
					title: "Question One",
					paragraphs: ["What would happen if the moon were made of lanterns?"],
				},
			],
		},
		annotations: [
			{
				chapterIndex: 0,
				selectedText: "What would happen if the moon were made of lanterns?",
				comment: "Path must sanitize ? and :",
				containsSpoiler: false,
				slot: 2,
			},
		],
	},
	{
		folder: "Scratch Pad",
		fileName: "Scratch Pad.epub",
		book: {
			id: "8f3c0a52-1f0e-4b1e-9d55-0c2d7c1a0004",
			title: "Scratch Pad",
			coverColor: [96, 140, 90],
			authors: ["Dee Draft"],
			subjects: ["Reference"],
			series: "Scratch Pad",
			seriesIndex: 1,
			chapters: [
				{
					title: "Blank Page",
					paragraphs: ["Tests annotate this page and then delete it again."],
				},
			],
		},
		annotations: [],
	},
];
