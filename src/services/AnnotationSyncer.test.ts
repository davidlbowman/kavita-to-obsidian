/**
 * Tests for the single-file syncer over an in-memory vault.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Layer } from "effect";
import { makeFakeApp } from "../../test-support/FakeApp.js";
import { KavitaNetworkError } from "../errors.js";
import { toMarkdown } from "../formatters/markdown.js";
import {
	Annotation,
	DEFAULT_SETTINGS,
	type PluginSettings,
	Volume,
} from "../schemas.js";
import { AnnotationSyncer } from "./AnnotationSyncer.js";
import { fetchChapterInfo } from "./ChapterCatalog.js";
import { KavitaClient } from "./KavitaClient.js";
import type { ObsidianApp } from "./ObsidianApp.js";
import { ObsidianVault } from "./ObsidianVault.js";
import { PluginConfig } from "./PluginConfig.js";

const EPOCH = "1970-01-01T00:00:00.000Z";

const fixture = Effect.gen(function* () {
	const annotations = yield* Arbitrary.sampleEffect(
		Arbitrary.schema(Annotation),
		{ count: 12 },
	);
	const volumes = yield* Arbitrary.sampleEffect(Arbitrary.schema(Volume), {
		count: 3,
	});
	const kavita = KavitaClient.of({
		annotations: Effect.succeed(annotations),
		volumes: () => Effect.succeed(volumes),
	});
	return { annotations, kavita };
});

const syncerLayer = (
	kavita: KavitaClient["Service"],
	app: ObsidianApp["Service"],
	overrides: Partial<PluginSettings>,
) =>
	AnnotationSyncer.layerNoDeps.pipe(
		Layer.provide(
			Layer.mergeAll(
				Layer.succeed(KavitaClient, kavita),
				ObsidianVault.layer(app),
			),
		),
		Layer.provideMerge(
			PluginConfig.fromSettings({
				...DEFAULT_SETTINGS,
				kavitaUrl: "http://kavita.test",
				kavitaApiKey: "key",
				exportMode: "single-file",
				...overrides,
			}),
		),
	);

const runSync = Effect.gen(function* () {
	return yield* (yield* AnnotationSyncer).sync;
});

describe("AnnotationSyncer", () => {
	it.effect("writes every annotation to the output note", () =>
		Effect.gen(function* () {
			const { annotations, kavita } = yield* fixture;
			const fake = makeFakeApp();
			const layer = syncerLayer(kavita, fake.app, {
				outputPath: "kavita-annotations.md",
			});

			const { result, expected } = yield* Effect.gen(function* () {
				const synced = yield* runSync;
				const config = yield* PluginConfig;
				const chapterInfo = yield* fetchChapterInfo(
					kavita,
					annotations.map((a) => a.seriesId),
				);
				return {
					result: synced,
					expected: toMarkdown(annotations, config, chapterInfo, EPOCH),
				};
			}).pipe(Effect.provide(layer));

			assert.deepStrictEqual(result, {
				annotationCount: annotations.length,
				outputPath: "kavita-annotations.md",
			});
			assert.strictEqual(fake.read("kavita-annotations.md"), expected);
			assert.include(expected, `updated: ${EPOCH}`);
		}),
	);

	it.effect("normalizes the output path and creates missing folders", () =>
		Effect.gen(function* () {
			const { kavita } = yield* fixture;
			const fake = makeFakeApp();
			const result = yield* runSync.pipe(
				Effect.provide(
					syncerLayer(kavita, fake.app, {
						outputPath: "/Reading//Kavita/all.md",
					}),
				),
			);
			assert.strictEqual(result.outputPath, "Reading/Kavita/all.md");
			assert.sameMembers([...fake.folders()], ["Reading", "Reading/Kavita"]);
			assert.isDefined(fake.read("Reading/Kavita/all.md"));
		}),
	);

	it.effect("overwrites the note on later syncs", () =>
		Effect.gen(function* () {
			const { kavita } = yield* fixture;
			const fake = makeFakeApp();
			fake.seed("kavita-annotations.md", "stale");
			yield* runSync.pipe(Effect.provide(syncerLayer(kavita, fake.app, {})));
			assert.notStrictEqual(fake.read("kavita-annotations.md"), "stale");
			assert.strictEqual(fake.files().size, 1);
		}),
	);

	it.effect("writes nothing when Kavita fails", () =>
		Effect.gen(function* () {
			const { kavita } = yield* fixture;
			const fake = makeFakeApp();
			const failing = KavitaClient.of({
				...kavita,
				annotations: Effect.fail(
					new KavitaNetworkError({
						endpoint: "/api/Annotation/all-filtered",
						statusCode: 500,
					}),
				),
			});
			const error = yield* Effect.flip(
				runSync.pipe(Effect.provide(syncerLayer(failing, fake.app, {}))),
			);
			assert.strictEqual(error._tag, "KavitaNetworkError");
			assert.strictEqual(fake.files().size, 0);
		}),
	);
});
