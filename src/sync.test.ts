/**
 * End-to-end tests for wiring and running a sync with fake HTTP and vault.
 *
 * @module
 */
import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { vi } from "vitest";
import { makeFakeApp } from "../test-support/FakeApp.js";
import { capturedNotices, clearCapturedNotices } from "./__mocks__/obsidian.js";
import {
	Annotation,
	Annotations,
	CurrentUser,
	DEFAULT_SETTINGS,
	PluginSession,
	type PluginSettings,
} from "./schemas.js";
import { runSync, syncAnnotations, syncLayer } from "./sync.js";
import { TROUBLESHOOTING_URL } from "./ui/errorNotice.js";

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

const library = Effect.gen(function* () {
	const [user] = yield* Arbitrary.sampleEffect(Arbitrary.schema(KavitaUser), {
		count: 1,
	});
	if (user === undefined) return yield* Effect.die("empty sample");
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
	return { annotations, http };
});

const settings = (overrides: Partial<PluginSettings> = {}): PluginSettings => ({
	...DEFAULT_SETTINGS,
	kavitaUrl: "http://kavita.test",
	kavitaApiKey: "key",
	...overrides,
});

const messages = () => capturedNotices.map((n) => n.message);

describe("runSync", () => {
	beforeEach(() => {
		clearCapturedNotices();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it.effect("reports a hierarchical sync", () =>
		Effect.gen(function* () {
			const { annotations, http } = yield* library;
			const fake = makeFakeApp();

			yield* runSync(settings(), fake.app, http);

			const seriesCount = new Set(annotations.map((a) => a.seriesId)).size;
			assert.lengthOf(capturedNotices, 1);
			assert.match(
				messages()[0] ?? "",
				new RegExp(
					`^Synced ${annotations.length} annotations across ${seriesCount} series \\(\\d+ books\\)$`,
				),
			);
			assert.isAbove(fake.files().size, 0);
		}),
	);

	it.effect("reports a single-file sync", () =>
		Effect.gen(function* () {
			const { annotations, http } = yield* library;
			const fake = makeFakeApp();

			yield* runSync(settings({ exportMode: "single-file" }), fake.app, http);

			assert.deepStrictEqual(messages(), [
				`Synced ${annotations.length} annotations to kavita-annotations.md`,
			]);
			assert.isDefined(fake.read("kavita-annotations.md"));
		}),
	);

	it.effect(
		"turns invalid settings into a notice with a troubleshooting link",
		() =>
			Effect.gen(function* () {
				const { http } = yield* library;
				const fake = makeFakeApp();

				yield* runSync(settings({ kavitaUrl: "" }), fake.app, http);

				assert.deepStrictEqual(messages(), [
					"Set your Kavita server URL in the plugin settings.",
					`See troubleshooting: ${TROUBLESHOOTING_URL}#how-to-verify-your-kavita-url`,
				]);
				assert.strictEqual(fake.files().size, 0);
			}),
	);

	it.effect("turns a rejected auth key into a notice", () =>
		Effect.gen(function* () {
			const fake = makeFakeApp();

			yield* runSync(
				settings(),
				fake.app,
				fakeKavita(() => json({}, 401)),
			);

			assert.lengthOf(capturedNotices, 2);
			assert.include(messages()[0], "rejected your auth key");
			assert.include(messages()[1], "#authentication-failed");
		}),
	);

	it.effect("reports defects without failing", () =>
		Effect.gen(function* () {
			const errors = vi.spyOn(console, "error").mockImplementation(() => {});
			const fake = makeFakeApp();
			const dying = Layer.succeed(
				HttpClient.HttpClient,
				HttpClient.make(() => Effect.die(new Error("boom"))),
			);

			yield* runSync(settings(), fake.app, dying);

			assert.deepStrictEqual(messages(), [
				"Sync failed unexpectedly. Check the developer console.",
			]);
			assert.strictEqual(errors.mock.calls.length, 1);
		}),
	);
});

describe("syncAnnotations", () => {
	it.effect("mentions removed orphans only when there are some", () =>
		Effect.gen(function* () {
			const { annotations, http } = yield* library;
			const fake = makeFakeApp();
			fake.seed(
				`${DEFAULT_SETTINGS.rootFolderName}/Old/orphan.md`,
				"---\nkavita_chapter_id: 0\n---\n",
			);
			const layer = syncLayer(settings(), fake.app, http);

			const first = yield* syncAnnotations.pipe(Effect.provide(layer));
			const second = yield* syncAnnotations.pipe(Effect.provide(layer));

			assert.include(first, `Synced ${annotations.length} annotations`);
			assert.match(first, /, removed 1 orphaned notes$/);
			assert.notInclude(second, "removed");
		}),
	);
});
