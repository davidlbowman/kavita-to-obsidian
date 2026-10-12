/**
 * End-to-end tests for wiring and running a sync with fake HTTP and vault.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { makeFakeApp } from "../test-support/FakeApp.js";
import {
	Annotation,
	Annotations,
	CurrentUser,
	DEFAULT_SETTINGS,
	PluginSession,
	type PluginSettings,
	SyncSummary,
} from "./schemas.js";
import {
	checkConnection,
	describeConnection,
	describeSummary,
	plural,
	recentHighlights,
	runSync,
	timeAgo,
} from "./sync.js";

/**
 * The Kavita user object, as both `/api/Plugin/authenticate` and
 * `/api/Account` return it.
 */
const KavitaUser = Schema.Struct({
	...PluginSession.fields,
	...CurrentUser.fields,
});

const json = (value: unknown, status = 200): Response =>
	new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});

const fakeKavita = (route: (pathname: string) => Response) =>
	Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request, url) =>
			Effect.sync(() =>
				HttpClientResponse.fromWeb(request, route(url.pathname)),
			),
		),
	);

const sampleOne = <S extends Schema.Top>(schema: S) =>
	Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 1 }).pipe(
		Effect.flatMap((values) =>
			values[0] === undefined
				? Effect.die("empty sample")
				: Effect.succeed(values[0]),
		),
	);

/**
 * A fake Kavita serving `user` and ten of their annotations.
 */
const library = Effect.gen(function* () {
	const user = yield* sampleOne(KavitaUser);
	const sampled = yield* Arbitrary.sampleEffect(Arbitrary.schema(Annotation), {
		count: 10,
	});
	const annotations = Schema.decodeUnknownSync(Annotations)(
		JSON.parse(
			JSON.stringify(
				Schema.encodeSync(Annotations)(
					sampled.map((a) => ({ ...a, ownerUserId: user.id })),
				),
			),
		),
	);
	const http = fakeKavita((pathname) => {
		switch (pathname) {
			case "/api/Plugin/authenticate":
			case "/api/Account":
				return json(Schema.encodeSync(KavitaUser)(user));
			case "/api/Annotation/all-filtered":
				return json(Schema.encodeSync(Annotations)(annotations));
			case "/api/Series/volumes":
				return json([]);
			default:
				return json({}, 404);
		}
	});
	return { user, annotations, http };
});

const settings = (overrides: Partial<PluginSettings> = {}): PluginSettings => ({
	...DEFAULT_SETTINGS,
	kavitaUrl: "http://kavita.test",
	kavitaApiKey: "key",
	...overrides,
});

const distinctChapters = (annotations: Annotations) =>
	new Set(annotations.map((a) => a.chapterId)).size;

type Annotations = ReadonlyArray<typeof Annotation.Type>;

describe("runSync", () => {
	it.effect("syncs one note per book", () =>
		Effect.gen(function* () {
			const { annotations, http } = yield* library;
			const fake = makeFakeApp();
			const summary = yield* runSync(settings(), fake.app, http);
			const books = distinctChapters(annotations);

			assert.strictEqual(summary.books, books);
			assert.strictEqual(summary.notesCreated, books);
			assert.strictEqual(
				summary.highlights,
				annotations.filter((a) => !a.containsSpoiler).length,
			);
			assert.strictEqual(
				[...fake.files().keys()].filter((p) => p.endsWith(".md")).length,
				books,
			);
		}),
	);

	it.effect("syncs everything into one note", () =>
		Effect.gen(function* () {
			const { annotations, http } = yield* library;
			const fake = makeFakeApp();
			const summary = yield* runSync(
				settings({
					exportMode: "single-file",
					outputPath: "Notes/All.md",
					includeSpoilers: true,
				}),
				fake.app,
				http,
			);
			assert.strictEqual(summary.openPath, "Notes/All.md");
			assert.strictEqual(summary.notesCreated, 1);
			assert.strictEqual(summary.highlights, annotations.length);
			assert.isDefined(fake.read("Notes/All.md"));
		}),
	);

	it.effect("fails with InvalidSettingsError before calling Kavita", () =>
		Effect.gen(function* () {
			const { http } = yield* library;
			const error = yield* Effect.flip(
				runSync(settings({ kavitaUrl: "" }), makeFakeApp().app, http),
			);
			assert.strictEqual(error._tag, "InvalidSettingsError");
		}),
	);

	it.effect("fails with KavitaAuthError for a rejected key", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				runSync(
					settings(),
					makeFakeApp().app,
					fakeKavita(() => json({}, 401)),
				),
			);
			assert.strictEqual(error._tag, "KavitaAuthError");
		}),
	);
});

describe("checkConnection", () => {
	it.effect("reports who the key belongs to and what it can sync", () =>
		Effect.gen(function* () {
			const { user, annotations, http } = yield* library;
			const info = yield* checkConnection(settings(), http);
			assert.deepStrictEqual(info, {
				username: user.username ?? "unknown user",
				kavitaVersion: user.kavitaVersion ?? "unknown version",
				highlights: annotations.length,
				books: distinctChapters(annotations),
			});
		}),
	);

	it.effect("falls back when Kavita omits the name and version", () =>
		Effect.gen(function* () {
			const user = yield* sampleOne(KavitaUser);
			const http = fakeKavita((pathname) =>
				pathname === "/api/Annotation/all-filtered"
					? json([])
					: json({ id: user.id, token: user.token }),
			);
			const info = yield* checkConnection(settings(), http);
			assert.deepStrictEqual(info, {
				username: "unknown user",
				kavitaVersion: "unknown version",
				highlights: 0,
				books: 0,
			});
		}),
	);

	it.effect("fails with the connection's error", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				checkConnection(
					settings(),
					fakeKavita(() => json({}, 404)),
				),
			);
			assert.strictEqual(error._tag, "KavitaNetworkError");
		}),
	);
});

describe("recentHighlights", () => {
	it.effect("returns the newest highlights first, up to the limit", () =>
		Effect.gen(function* () {
			const { annotations, http } = yield* library;
			const recent = yield* recentHighlights(settings(), http, 3);
			const expected = annotations
				.toSorted((a, b) => b.createdUtc.localeCompare(a.createdUtc))
				.slice(0, 3);
			assert.deepStrictEqual(recent, expected);
		}),
	);
});

const summary = (overrides: Partial<SyncSummary> = {}): SyncSummary => ({
	highlights: 0,
	newHighlights: 0,
	books: 0,
	notesCreated: 0,
	notesUpdated: 0,
	notesUnchanged: 0,
	notesDeleted: 0,
	openPath: "",
	...overrides,
});

describe("describeSummary", () => {
	it("says when everything is up to date", () => {
		assert.strictEqual(
			describeSummary(summary({ highlights: 1, books: 1, notesUnchanged: 1 })),
			"1 highlight from 1 book · everything up to date",
		);
	});

	it("counts new highlights and removed notes", () => {
		assert.strictEqual(
			describeSummary(
				summary({
					highlights: 12,
					books: 3,
					newHighlights: 2,
					notesUpdated: 1,
					notesDeleted: 2,
				}),
			),
			"12 highlights from 3 books · 2 new · 2 notes removed",
		);
		assert.strictEqual(
			describeSummary(summary({ highlights: 2, books: 1, notesDeleted: 1 })),
			"2 highlights from 1 book · 1 note removed",
		);
	});

	it("is not up to date when notes were rewritten", () => {
		assert.strictEqual(
			describeSummary(summary({ highlights: 4, books: 2, notesUpdated: 1 })),
			"4 highlights from 2 books",
		);
		assert.strictEqual(
			describeSummary(summary({ highlights: 4, books: 2, notesCreated: 1 })),
			"4 highlights from 2 books",
		);
	});

	it.prop(
		"always leads with the highlight and book counts",
		[SyncSummary],
		([value]) => {
			assert.isTrue(
				describeSummary(value).startsWith(
					`${plural(value.highlights, "highlight")} from ${plural(value.books, "book")}`,
				),
			);
		},
	);
});

describe("describeConnection", () => {
	it("names the user, version, and counts", () => {
		assert.strictEqual(
			describeConnection({
				username: "admin",
				kavitaVersion: "0.9.1.4",
				highlights: 1,
				books: 2,
			}),
			"Connected as admin · Kavita 0.9.1.4 · 1 highlight in 2 books",
		);
	});
});

describe("plural", () => {
	it("pluralizes everything but one", () => {
		assert.strictEqual(plural(0, "book"), "0 books");
		assert.strictEqual(plural(1, "book"), "1 book");
		assert.strictEqual(plural(2, "book"), "2 books");
	});
});

describe("timeAgo", () => {
	const now = Date.parse("2026-10-12T12:00:00.000Z");
	const minutesAgo = (minutes: number) =>
		new Date(now - minutes * 60_000).toISOString();

	it.each([
		[minutesAgo(0), "just now"],
		[minutesAgo(1), "1 minute ago"],
		[minutesAgo(45), "45 minutes ago"],
		[minutesAgo(60), "1 hour ago"],
		[minutesAgo(5 * 60), "5 hours ago"],
		[minutesAgo(24 * 60), "1 day ago"],
		[minutesAgo(3 * 24 * 60), "3 days ago"],
		["", "never"],
		["not a date", "never"],
	])("%s → %s", (iso, expected) => {
		assert.strictEqual(timeAgo(iso, now), expected);
	});
});
