/**
 * Setup script for Kavita test instance using our Effect services.
 *
 * Usage: bun run test-integration/scripts/setup-kavita.ts
 *
 * @module
 */

import { execSync } from "node:child_process";
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
			Schedule.recurs(10).pipe(
				Schedule.addDelay(() => "2 seconds"),
				Schedule.tapOutput((out) => Effect.log(`Attempt ${out + 1}/10...`)),
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

		// Restart Kavita to ensure filesystem is properly detected (WSL2/Docker workaround)
		yield* Effect.log("Restarting Kavita to refresh filesystem...");
		yield* Effect.sync(() => {
			execSync("docker restart kavita-test", { stdio: "inherit" });
		});

		// Wait for Kavita to come back up
		yield* Effect.sleep("5 seconds");
		yield* Effect.log("Waiting for Kavita to restart...");
		const authClient = yield* KavitaAuthClient;
		const authClientForUrl = authClient.forUrl(KAVITA_URL);
		yield* authClientForUrl.healthCheck.pipe(
			Effect.retry(
				Schedule.recurs(10).pipe(Schedule.addDelay(() => "2 seconds")),
			),
		);

		yield* Effect.log("Triggering library scan...");
		yield* client.scanLibrary(1);

		yield* Effect.log("Waiting for scan to complete...");
		yield* Effect.gen(function* () {
			for (let i = 0; i < 10; i++) {
				yield* Effect.sleep("2 seconds");
				const series = yield* client.getAllSeries;
				if (series.length > 0) {
					yield* Effect.log(`Found ${series.length} series`);
					return;
				}
				yield* Effect.log(`Waiting... (${i + 1}/10)`);
			}
		});
	} else {
		yield* Effect.log(`Found ${libraries.length} existing libraries`);
	}

	// Verify series detection and create test annotations
	const series = yield* client.getAllSeries;
	const firstSeries = series[0];
	if (firstSeries) {
		yield* Effect.log(`Found series: ${firstSeries.name}`);

		const volumes = yield* client.getVolumes(firstSeries.id);
		const firstVolume = volumes[0];
		const chapters = volumes.flatMap((v) => v.chapters);
		const firstChapter = chapters[0];

		yield* Effect.log(
			`Series has ${volumes.length} volumes and ${chapters.length} chapters`,
		);

		if (firstVolume && firstChapter) {
			// Check if annotations already exist
			const existingAnnotations = yield* client.fetchAllAnnotations;
			if (existingAnnotations.length === 0) {
				yield* Effect.log("Creating test annotations...");

				// Sample annotations matching content from our test EPUB
				const sampleAnnotations = [
					{
						xPath: "/html/body/p[1]",
						selectedText:
							"This is the first paragraph of the test book. It contains some text that can be highlighted and annotated.",
						comment: "Opening paragraph - sets the stage",
						containsSpoiler: false,
					},
					{
						xPath: "/html/body/p[3]",
						selectedText:
							"The journey of a thousand miles begins with a single step.",
						comment: "Famous quote worth remembering",
						containsSpoiler: false,
					},
					{
						xPath: "/html/body/p[2]",
						selectedText:
							"The second paragraph provides more content for testing annotations.",
						comment: "This contains a spoiler!",
						containsSpoiler: true,
					},
					{
						xPath: "/html/body/h1",
						selectedText: "Chapter 1: The Beginning",
						comment: undefined, // No comment on this one
						containsSpoiler: false,
					},
				];

				for (const annotation of sampleAnnotations) {
					yield* client.createAnnotation({
						chapterId: firstChapter.id,
						volumeId: firstVolume.id,
						seriesId: firstSeries.id,
						libraryId: firstSeries.libraryId ?? 1,
						ownerUserId: 1, // Admin user
						xPath: annotation.xPath,
						selectedText: annotation.selectedText,
						highlightCount: annotation.selectedText.length,
						pageNumber: 1,
						selectedSlotIndex: 0,
						containsSpoiler: annotation.containsSpoiler,
						comment: annotation.comment,
					});
				}
				yield* Effect.log(`Created ${sampleAnnotations.length} annotations`);
			} else {
				yield* Effect.log(
					`Found ${existingAnnotations.length} existing annotations`,
				);
			}
		}
	} else {
		yield* Effect.log(
			"No series found - add an EPUB to test-integration/books/",
		);
	}

	// Verify annotations
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
