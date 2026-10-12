/**
 * Tests for settings and Kavita payload schemas.
 *
 * @module
 */
import { describe, expect, it } from "@effect/vitest";
import { Exit, Schema } from "effect";
import {
	Annotation,
	Annotations,
	DEFAULT_ANNOTATION_TEMPLATE,
	DEFAULT_SETTINGS,
	decodePluginSettings,
	ExportMode,
	KavitaUrl,
	PluginSettings,
	Volumes,
} from "./schemas.js";

describe("PluginSettings", () => {
	it("has the documented defaults", () => {
		expect(DEFAULT_SETTINGS).toEqual({
			kavitaUrl: "",
			kavitaApiKey: "",
			exportMode: "hierarchical",
			outputPath: "kavita-annotations.md",
			rootFolderName: "Kavita Annotations",
			deleteOrphanedFiles: true,
			includeComments: true,
			includeSpoilers: false,
			includeTags: true,
			tagPrefix: "",
			includeWikilinks: true,
			annotationTemplate: DEFAULT_ANNOTATION_TEMPLATE,
		});
	});

	it.prop("never throws on arbitrary input", [Schema.Unknown], ([input]) => {
		expect(Schema.is(PluginSettings)(decodePluginSettings(input))).toBe(true);
	});

	it.prop(
		"never throws on arbitrary records",
		[Schema.Record(Schema.String, Schema.Unknown)],
		([input]) => {
			expect(Schema.is(PluginSettings)(decodePluginSettings(input))).toBe(true);
		},
	);

	it.prop(
		"round-trips valid settings unchanged",
		[PluginSettings],
		([settings]) => {
			expect(decodePluginSettings(settings)).toEqual(settings);
		},
	);

	it("falls back per field and keeps valid siblings", () => {
		expect(
			decodePluginSettings({
				kavitaUrl: "http://kavita.local",
				includeTags: "nope",
				exportMode: "bogus",
				deleteOrphanedFiles: false,
				tagPrefix: 42,
			}),
		).toEqual({
			...DEFAULT_SETTINGS,
			kavitaUrl: "http://kavita.local",
			deleteOrphanedFiles: false,
		});
	});

	it("drops unknown and legacy keys", () => {
		const decoded = decodePluginSettings({
			matchThreshold: 0.7,
			somethingElse: true,
		});
		expect(decoded).toEqual(DEFAULT_SETTINGS);
		expect(Object.keys(decoded)).not.toContain("matchThreshold");
	});

	it("treats null and non-objects as a fresh install", () => {
		expect(decodePluginSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(decodePluginSettings("garbage")).toEqual(DEFAULT_SETTINGS);
	});

	it.prop("accepts every export mode", [ExportMode], ([exportMode]) => {
		expect(decodePluginSettings({ exportMode }).exportMode).toBe(exportMode);
	});
});

describe("KavitaUrl", () => {
	const decode = Schema.decodeUnknownExit(KavitaUrl);

	it("accepts http and https URLs", () => {
		const http = decode("http://localhost:5000");
		const https = decode("https://kavita.example.com/sub/path");
		expect(Exit.isSuccess(http) && http.value.href).toBe(
			"http://localhost:5000/",
		);
		expect(Exit.isSuccess(https) && https.value.pathname).toBe("/sub/path");
	});

	it("rejects other schemes and garbage", () => {
		for (const input of [
			"ftp://kavita",
			"file:///etc/passwd",
			"not a url",
			"",
			42,
		]) {
			expect(Exit.isFailure(decode(input))).toBe(true);
		}
	});
});

describe("Kavita payloads", () => {
	it("decodes null arrays and missing optional keys", () => {
		expect(
			Schema.decodeUnknownSync(Volumes)([
				{ id: 1, number: 1, name: null, chapters: null },
				{
					id: 2,
					number: 2.5,
					chapters: [
						{ id: 3, writers: null, genres: [{ title: "Fantasy", id: 9 }] },
						{ id: 4, titleName: null },
					],
				},
			]),
		).toEqual([
			{ id: 1, number: 1, name: null, chapters: [] },
			{
				id: 2,
				number: 2.5,
				chapters: [
					{ id: 3, writers: [], genres: [{ title: "Fantasy" }] },
					{ id: 4, titleName: null },
				],
			},
		]);
	});

	it.prop("re-encodes decoded volumes", [Volumes], ([volumes]) => {
		const encoded = Schema.encodeSync(Volumes)(volumes);
		expect(Schema.decodeUnknownSync(Volumes)(encoded)).toEqual(volumes);
	});

	it.prop(
		"ignores extra fields Kavita sends on annotations",
		[Annotation],
		([annotation]) => {
			const wire = {
				...annotation,
				xPath: "/html/body/p[1]",
				likes: [],
				ageRating: 0,
				ownerUsername: "admin",
			};
			expect(Schema.decodeUnknownSync(Annotations)([wire])).toEqual([
				annotation,
			]);
		},
	);

	it("rejects annotations missing required fields", () => {
		expect(
			Exit.isFailure(Schema.decodeUnknownExit(Annotations)([{ id: 1 }])),
		).toBe(true);
	});
});
