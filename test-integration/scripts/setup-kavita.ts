/**
 * Setup script for Kavita test instance using our Effect services.
 *
 * Usage: bun run test-integration/scripts/setup-kavita.ts
 *
 * @module
 */
import { FetchHttpClient } from "@effect/platform";
import { Effect, Layer, Redacted, Schedule } from "effect";
import { LibraryType } from "../../src/schemas.js";
import { KavitaAuthClient } from "../../src/services/KavitaAuthClient.js";
import { KavitaClient } from "../../src/services/KavitaClient.js";
import { PluginConfig } from "../../src/services/PluginConfig.js";

const KAVITA_URL = process.env.KAVITA_URL ?? "http://localhost:5000";
const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "Test123!";

/**
 * Wait for Kavita to be ready using our KavitaAuthClient.
 */
const waitForKavita = Effect.gen(function* () {
	const authClient = yield* KavitaAuthClient;
	const client = authClient.forUrl(KAVITA_URL);

	yield* Effect.log("Waiting for Kavita to be ready...");

	yield* client.healthCheck.pipe(
		Effect.retry(
			Schedule.recurs(30).pipe(
				Schedule.addDelay(() => "2 seconds"),
				Schedule.tapOutput((out) => Effect.log(`Attempt ${out + 1}/30...`)),
			),
		),
	);

	yield* Effect.log("Kavita is ready!");
});

/**
 * Bootstrap: register admin and get API key.
 */
const bootstrap = Effect.gen(function* () {
	const authClient = yield* KavitaAuthClient;
	const client = authClient.forUrl(KAVITA_URL);

	yield* Effect.log("Registering admin user...");
	yield* client.register({
		username: ADMIN_USERNAME,
		email: ADMIN_EMAIL,
		password: ADMIN_PASSWORD,
	});

	yield* Effect.log("Logging in...");
	const user = yield* client.login({
		username: ADMIN_USERNAME,
		password: ADMIN_PASSWORD,
	});

	yield* Effect.log("Getting API key...");
	const apiKey = yield* client.resetApiKey(user.token);

	yield* Effect.log("API key obtained");
	return apiKey;
});

/**
 * Setup library and seed data using KavitaClient.
 */
const setupData = Effect.gen(function* () {
	const client = yield* KavitaClient;

	yield* Effect.log("Checking libraries...");
	const libraries = yield* client.getLibraries;

	if (libraries.length === 0) {
		yield* Effect.log("Creating test library...");
		yield* client.createLibrary({
			name: "Test Books",
			type: LibraryType.Book,
			folders: ["/data"],
			fileGroupTypes: [],
			excludePatterns: [],
		});

		yield* Effect.log("Triggering library scan...");
		yield* client.scanAllLibraries;

		yield* Effect.log("Waiting for scan to complete...");
		yield* Effect.gen(function* () {
			for (let i = 0; i < 30; i++) {
				yield* Effect.sleep("2 seconds");
				const series = yield* client.getAllSeries;
				if (series.length > 0) {
					yield* Effect.log(`Found ${series.length} series`);
					return;
				}
				yield* Effect.log(`Waiting... (${i + 1}/30)`);
			}
		});
	} else {
		yield* Effect.log(`Found ${libraries.length} existing libraries`);
	}

	// Create sample annotations if we have series
	const series = yield* client.getAllSeries;
	const firstSeries = series[0];
	if (firstSeries) {
		yield* Effect.log(`Found series: ${firstSeries.name}`);

		const volumes = yield* client.getVolumes(firstSeries.id);
		const chapters = volumes.flatMap((v) => v.chapters);
		const firstChapter = chapters[0];

		if (firstChapter) {
			const chapterId = firstChapter.id;
			yield* Effect.log(
				`Creating sample annotations on chapter ${chapterId}...`,
			);

			const sampleAnnotations: Array<{
				chapterId: number;
				content: string;
				comment?: string;
				spoiler?: boolean;
			}> = [
				{
					chapterId,
					content:
						"This is a fascinating passage about the nature of existence.",
					comment: "Deep philosophical insight here",
				},
				{
					chapterId,
					content: "The author's use of metaphor is remarkable.",
					comment: "Note: compare with chapter 3",
				},
				{
					chapterId,
					content: "Plot twist! Everything changes from here.",
					comment: "Major spoiler",
					spoiler: true,
				},
				{
					chapterId,
					content: "Beautiful prose that deserves to be remembered.",
				},
			];

			for (const annotation of sampleAnnotations) {
				yield* client.createAnnotation({
					chapterId: annotation.chapterId,
					content: annotation.content,
					comment: annotation.comment,
					spoiler: annotation.spoiler ?? false,
				});
			}
			yield* Effect.log(`Created ${sampleAnnotations.length} annotations`);
		}
	} else {
		yield* Effect.log(
			"No series found - add an EPUB to test-integration/books/",
		);
	}

	// Verify
	const annotations = yield* client.fetchAllAnnotations;
	yield* Effect.log(`Total annotations: ${annotations.length}`);
});

/**
 * Build the KavitaClient layer with a given API key.
 * Uses DefaultWithoutDependencies to override the built-in PluginConfig.Default.
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
				}),
			),
		),
		Layer.provide(FetchHttpClient.layer),
	);

/**
 * Main setup program.
 */
const main = Effect.gen(function* () {
	// Phase 1: Wait for Kavita and bootstrap auth
	yield* waitForKavita;
	const apiKey = yield* bootstrap;

	// Phase 2: Setup data with authenticated client
	yield* setupData.pipe(Effect.provide(makeKavitaClientLayer(apiKey)));

	// Write .env.test
	yield* Effect.promise(() =>
		Bun.write(
			"test-integration/.env.test",
			`KAVITA_URL=${KAVITA_URL}\nKAVITA_API_KEY=${apiKey}\n`,
		),
	);

	yield* Effect.log("Setup complete!");
	yield* Effect.log(`Environment written to: test-integration/.env.test`);
});

// Run with auth client layer (FetchHttpClient is included via dependencies)
const program = main.pipe(Effect.provide(KavitaAuthClient.Default));

Effect.runPromise(program as Effect.Effect<void>).catch((error) => {
	console.error("Setup failed:", error);
	process.exit(1);
});
