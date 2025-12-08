/**
 * Setup script to create 10,000 annotations for stress testing.
 *
 * Usage: bun run test-integration/scripts/setup-stress-test.ts
 *
 * Prerequisites:
 * - Kavita must be running with the stress test EPUB scanned
 * - Run `bun run integration:stress:up` first
 *
 * @module
 */

import { FetchHttpClient } from "@effect/platform";
import { Effect, Layer, Redacted, Schedule } from "effect";
import { KavitaAuthClient } from "../../src/services/KavitaAuthClient.js";
import { KavitaClient } from "../../src/services/KavitaClient.js";
import { PluginConfig } from "../../src/services/PluginConfig.js";

const KAVITA_URL = process.env.KAVITA_URL ?? "http://localhost:5000";
const KAVITA_API_KEY = process.env.KAVITA_API_KEY;

/** Target number of annotations to create */
const TARGET_ANNOTATIONS = 10_000;
/** Batch size for annotation creation (avoid overwhelming the API) */
const BATCH_SIZE = 100;

/**
 * Generate unique annotation content.
 */
function generateAnnotationContent(index: number): {
	xPath: string;
	selectedText: string;
	comment: string | undefined;
	containsSpoiler: boolean;
} {
	const chapterNum = Math.floor(index / 100) + 1;
	const paragraphNum = (index % 100) + 1;

	const comments = [
		"Important plot point to remember",
		"Great character development here",
		"Foreshadowing for later events",
		"Beautiful prose worth revisiting",
		"Key worldbuilding detail",
		undefined, // Some annotations without comments
		"Symbolism worth analyzing",
		"Thematic connection to earlier chapters",
		undefined,
		"Memorable quote",
	];

	return {
		xPath: `/html/body/p[${paragraphNum}]`,
		selectedText: `[Ch${chapterNum}:P${paragraphNum}] This passage contains important details about the story that readers might want to highlight and annotate for future reference.`,
		comment: comments[index % comments.length],
		containsSpoiler: index % 20 === 0, // 5% spoilers
	};
}

/**
 * Wait for Kavita to be ready.
 */
const waitForKavita = Effect.gen(function* () {
	const authClient = yield* KavitaAuthClient;
	const client = authClient.forUrl(KAVITA_URL);

	yield* Effect.log("Waiting for Kavita to be ready...");

	yield* client.healthCheck.pipe(
		Effect.retry(
			Schedule.recurs(10).pipe(
				Schedule.addDelay(() => "2 seconds"),
				Schedule.tapOutput((out) => Effect.log(`Attempt ${out + 1}/10...`)),
			),
		),
	);

	yield* Effect.log("Kavita is ready!");
});

/**
 * Login and get API key from env (required).
 */
const getApiKey: Effect.Effect<string, Error> = Effect.gen(function* () {
	if (!KAVITA_API_KEY) {
		return yield* Effect.fail(
			new Error(
				"KAVITA_API_KEY not set. Run integration:setup first, then source .env.test",
			),
		);
	}
	yield* Effect.log("Using API key from environment");
	return KAVITA_API_KEY;
});

/**
 * Build the KavitaClient layer with a given API key.
 */
const makeKavitaClientLayer = (apiKey: string) =>
	KavitaClient.DefaultWithoutDependencies.pipe(
		Layer.provide(
			Layer.succeed(
				PluginConfig,
				new PluginConfig({
					kavitaUrl: new URL(KAVITA_URL),
					kavitaApiKey: Redacted.make(apiKey),
					outputPath: "kavita-annotations.md",
					matchThreshold: 0.7,
					includeComments: true,
					includeSpoilers: false,
					includeTags: true,
					tagPrefix: "kavita/",
					includeWikilinks: true,
				}),
			),
		),
		Layer.provide(FetchHttpClient.layer),
	);

/**
 * Create 10,000 annotations in batches.
 */
const createBulkAnnotations = Effect.gen(function* () {
	const client = yield* KavitaClient;

	yield* Effect.log("Finding stress test series...");
	const series = yield* client.getAllSeries;
	const stressSeries = series.find((s) => s.name.includes("Stress"));

	if (!stressSeries) {
		yield* Effect.fail(
			new Error(
				"Stress test series not found. Run integration:stress:up first.",
			),
		);
		return;
	}

	yield* Effect.log(
		`Found series: ${stressSeries.name} (ID: ${stressSeries.id})`,
	);

	const volumes = yield* client.getVolumes(stressSeries.id);
	const chapters = volumes.flatMap((v) => v.chapters);

	yield* Effect.log(
		`Series has ${volumes.length} volumes and ${chapters.length} chapters`,
	);

	if (chapters.length === 0) {
		yield* Effect.fail(new Error("No chapters found in stress series"));
		return;
	}

	const existingAnnotations = yield* client.fetchAllAnnotations;
	const existingForSeries = existingAnnotations.filter(
		(a) => a.seriesId === stressSeries.id,
	);

	if (existingForSeries.length >= TARGET_ANNOTATIONS) {
		yield* Effect.log(
			`Already have ${existingForSeries.length} annotations for stress series`,
		);
		return;
	}

	const toCreate = TARGET_ANNOTATIONS - existingForSeries.length;
	yield* Effect.log(
		`Creating ${toCreate} annotations in batches of ${BATCH_SIZE}...`,
	);

	const startTime = Date.now();
	let created = 0;

	for (let batch = 0; batch < Math.ceil(toCreate / BATCH_SIZE); batch++) {
		const batchStart = batch * BATCH_SIZE;
		const batchEnd = Math.min(batchStart + BATCH_SIZE, toCreate);

		yield* Effect.log(
			`Batch ${batch + 1}: creating annotations ${batchStart + 1} to ${batchEnd}...`,
		);

		for (let i = batchStart; i < batchEnd; i++) {
			const globalIndex = existingForSeries.length + i;
			const chapterIndex = globalIndex % chapters.length;
			const chapter = chapters[chapterIndex];
			if (!chapter) continue;

			const volume = volumes.find((v) =>
				v.chapters.some((c) => c.id === chapter.id),
			);

			if (!volume) continue;

			const content = generateAnnotationContent(globalIndex);

			yield* client.createAnnotation({
				chapterId: chapter.id,
				volumeId: volume.id,
				seriesId: stressSeries.id,
				libraryId: stressSeries.libraryId ?? 1,
				ownerUserId: 1,
				xPath: content.xPath,
				selectedText: content.selectedText,
				highlightCount: content.selectedText.length,
				pageNumber: Math.floor(globalIndex / 10) + 1,
				selectedSlotIndex: globalIndex % 5,
				containsSpoiler: content.containsSpoiler,
				comment: content.comment,
			});

			created++;
		}

		const elapsed = (Date.now() - startTime) / 1000;
		const rate = created / elapsed;
		const remaining = toCreate - created;
		const eta = remaining / rate;

		yield* Effect.log(
			`  Progress: ${created}/${toCreate} (${rate.toFixed(1)}/sec, ETA: ${eta.toFixed(0)}s)`,
		);
	}

	const totalTime = (Date.now() - startTime) / 1000;
	yield* Effect.log(
		`Created ${created} annotations in ${totalTime.toFixed(1)} seconds`,
	);
	yield* Effect.log(
		`Average rate: ${(created / totalTime).toFixed(1)} annotations/second`,
	);
});

/**
 * Verify the annotations were created.
 */
const verifyAnnotations = Effect.gen(function* () {
	const client = yield* KavitaClient;

	yield* Effect.log("Verifying annotations...");
	const startTime = Date.now();
	const annotations = yield* client.fetchAllAnnotations;
	const fetchTime = Date.now() - startTime;

	yield* Effect.log(`Total annotations: ${annotations.length}`);
	yield* Effect.log(`Fetch time: ${fetchTime}ms`);
	yield* Effect.log(
		`Fetch rate: ${((annotations.length / fetchTime) * 1000).toFixed(0)} annotations/second`,
	);
});

/**
 * Main program.
 */
const main = Effect.gen(function* () {
	yield* waitForKavita;
	const apiKey = yield* getApiKey;

	const layer = makeKavitaClientLayer(apiKey);

	yield* createBulkAnnotations.pipe(Effect.provide(layer));
	yield* verifyAnnotations.pipe(Effect.provide(layer));

	yield* Effect.log("Stress test setup complete!");
});

const program = main.pipe(Effect.provide(KavitaAuthClient.Default));

Effect.runPromise(program as Effect.Effect<void>).catch((error) => {
	console.error("Stress test setup failed:", error);
	process.exit(1);
});
