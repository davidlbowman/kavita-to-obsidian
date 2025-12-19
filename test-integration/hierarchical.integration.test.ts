/**
 * Integration tests for HierarchicalSyncer.
 *
 * These tests run against a real Kavita instance and verify
 * the folder structure and file content generation.
 *
 * Run `bun run integration:up && bun run integration:setup` first.
 *
 * @module
 */
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { FetchHttpClient } from "@effect/platform";
import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { HierarchicalSyncer } from "../src/services/HierarchicalSyncer.js";
import { KavitaClient } from "../src/services/KavitaClient.js";
import { ObsidianAdapter } from "../src/services/ObsidianAdapter.js";
import { PluginConfig } from "../src/services/PluginConfig.js";

const KAVITA_URL = process.env.KAVITA_URL ?? "http://localhost:5000";
const KAVITA_API_KEY = process.env.KAVITA_API_KEY ?? "";
const TEST_OUTPUT_DIR = "test-integration/output";
const ROOT_FOLDER = "Kavita Annotations";

/**
 * Create a mock ObsidianAdapter that writes to the filesystem.
 * This allows us to test the actual file output.
 */
const createFilesystemAdapter = (baseDir: string) => {
	const ensureDir = (path: string) => {
		const fullPath = join(baseDir, path);
		if (!existsSync(fullPath)) {
			mkdirSync(fullPath, { recursive: true });
		}
	};

	return Layer.succeed(ObsidianAdapter, {
		writeFile: (path: string, content: string) =>
			Effect.sync(() => {
				const fullPath = join(baseDir, path);
				const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
				ensureDir(dir.replace(`${baseDir}/`, ""));
				writeFileSync(fullPath, content, "utf-8");
			}),
		appendToFile: () => Effect.void,
		readFile: (path: string) =>
			Effect.sync(() => {
				const fullPath = join(baseDir, path);
				return existsSync(fullPath) ? readFileSync(fullPath, "utf-8") : "";
			}),
		getFile: (path: string) =>
			Effect.succeed(
				existsSync(join(baseDir, path)) ? Option.some({ path }) : Option.none(),
			),
		listMarkdownFiles: Effect.succeed([]),
		ensureFolderExists: (path: string) =>
			Effect.sync(() => {
				ensureDir(path);
			}),
		deleteFile: (path: string) =>
			Effect.sync(() => {
				const fullPath = join(baseDir, path);
				if (existsSync(fullPath)) {
					rmSync(fullPath);
				}
			}),
		listFilesInFolder: (path: string) =>
			Effect.sync(() => {
				const fullPath = join(baseDir, path);
				if (!existsSync(fullPath)) return [];
				return readdirSync(fullPath, { withFileTypes: true })
					.filter((d) => d.isFile())
					.map((d) => d.name);
			}),
		listFoldersInFolder: (path: string) =>
			Effect.sync(() => {
				const fullPath = join(baseDir, path);
				if (!existsSync(fullPath)) return [];
				return readdirSync(fullPath, { withFileTypes: true })
					.filter((d) => d.isDirectory())
					.map((d) => d.name);
			}),
		folderExists: (path: string) =>
			Effect.succeed(existsSync(join(baseDir, path))),
		deleteFolder: (path: string) =>
			Effect.sync(() => {
				const fullPath = join(baseDir, path);
				if (existsSync(fullPath)) {
					rmSync(fullPath, { recursive: true });
				}
			}),
	} as unknown as typeof ObsidianAdapter.Service);
};

const TestConfigLayer = Layer.succeed(
	PluginConfig,
	new PluginConfig({
		kavitaUrl: new URL(KAVITA_URL),
		kavitaApiKey: Redacted.make(KAVITA_API_KEY),
		outputPath: "test-output.md",
		matchThreshold: 0.7,
		includeComments: true,
		includeSpoilers: false,
		includeTags: true,
		tagPrefix: "",
		includeWikilinks: true,
		exportMode: "hierarchical",
		rootFolderName: ROOT_FOLDER,
		deleteOrphanedFiles: true,
	}),
);

const KavitaClientLayer = KavitaClient.DefaultWithoutDependencies.pipe(
	Layer.provide(TestConfigLayer),
	Layer.provide(FetchHttpClient.layer),
);

describe("HierarchicalSyncer Integration", () => {
	beforeAll(() => {
		if (existsSync(TEST_OUTPUT_DIR)) {
			rmSync(TEST_OUTPUT_DIR, { recursive: true });
		}
		mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
	});

	afterAll(() => {
		if (existsSync(TEST_OUTPUT_DIR)) {
			rmSync(TEST_OUTPUT_DIR, { recursive: true });
		}
	});

	it.effect.skip("syncs annotations to hierarchical folder structure", () =>
		Effect.gen(function* () {
			const syncer = yield* HierarchicalSyncer;
			const result = yield* syncer.syncAll;

			expect(result.totalAnnotations).toBeGreaterThan(0);
			expect(result.seriesCount).toBeGreaterThan(0);
			expect(result.bookCount).toBeGreaterThan(0);

			// Verify root folder was created
			const rootPath = join(TEST_OUTPUT_DIR, ROOT_FOLDER);
			expect(existsSync(rootPath)).toBe(true);

			// Verify series folder exists
			const seriesFolders = readdirSync(rootPath, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name);
			expect(seriesFolders.length).toBeGreaterThan(0);

			const firstSeriesFolder = seriesFolders[0];
			if (!firstSeriesFolder) {
				throw new Error("No series folders found");
			}

			// Verify book files exist
			const firstSeriesPath = join(rootPath, firstSeriesFolder);
			const bookFiles = readdirSync(firstSeriesPath, { withFileTypes: true })
				.filter((d) => d.isFile() && d.name.endsWith(".md"))
				.map((d) => d.name);
			expect(bookFiles.length).toBeGreaterThan(0);

			const firstBookFile = bookFiles[0];
			if (!firstBookFile) {
				throw new Error("No book files found");
			}

			// Verify book file content
			const firstBookPath = join(firstSeriesPath, firstBookFile);
			const content = readFileSync(firstBookPath, "utf-8");

			// Check frontmatter
			expect(content).toContain("---");
			expect(content).toContain("tags:");
			expect(content).toContain("kavita");

			// Check structure
			expect(content).toContain("## Annotations");
			expect(content).toContain("> ");

			yield* Effect.log(`Synced ${result.totalAnnotations} annotations`);
			yield* Effect.log(`Created ${result.bookCount} book files`);
			yield* Effect.log(`Across ${result.seriesCount} series`);
		}).pipe(
			Effect.provide(HierarchicalSyncer.Default),
			Effect.provide(KavitaClientLayer),
			Effect.provide(createFilesystemAdapter(TEST_OUTPUT_DIR)),
			Effect.provide(TestConfigLayer),
		),
	);

	it.effect.skip("generates correct frontmatter with tags", () =>
		Effect.gen(function* () {
			const syncer = yield* HierarchicalSyncer;
			yield* syncer.syncAll;

			const rootPath = join(TEST_OUTPUT_DIR, ROOT_FOLDER);
			const seriesFolders = readdirSync(rootPath, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name);

			const firstSeriesFolder = seriesFolders[0];
			if (!firstSeriesFolder) {
				throw new Error("No series folders found");
			}

			const firstSeriesPath = join(rootPath, firstSeriesFolder);
			const bookFiles = readdirSync(firstSeriesPath).filter((f) =>
				f.endsWith(".md"),
			);

			const firstBookFile = bookFiles[0];
			if (!firstBookFile) {
				throw new Error("No book files found");
			}

			const content = readFileSync(
				join(firstSeriesPath, firstBookFile),
				"utf-8",
			);

			// Verify kavita_series_id and kavita_chapter_id in frontmatter
			expect(content).toMatch(/kavita_series_id:\s*\d+/);
			expect(content).toMatch(/kavita_chapter_id:\s*\d+/);

			// Verify series tag
			expect(content).toMatch(/series\/[\w-]+/);
		}).pipe(
			Effect.provide(HierarchicalSyncer.Default),
			Effect.provide(KavitaClientLayer),
			Effect.provide(createFilesystemAdapter(TEST_OUTPUT_DIR)),
			Effect.provide(TestConfigLayer),
		),
	);

	it.effect.skip("includes wikilinks for series name", () =>
		Effect.gen(function* () {
			const syncer = yield* HierarchicalSyncer;
			yield* syncer.syncAll;

			const rootPath = join(TEST_OUTPUT_DIR, ROOT_FOLDER);
			const seriesFolders = readdirSync(rootPath, { withFileTypes: true })
				.filter((d) => d.isDirectory())
				.map((d) => d.name);

			const firstSeriesFolder = seriesFolders[0];
			if (!firstSeriesFolder) {
				throw new Error("No series folders found");
			}

			const firstSeriesPath = join(rootPath, firstSeriesFolder);
			const bookFiles = readdirSync(firstSeriesPath).filter((f) =>
				f.endsWith(".md"),
			);

			const firstBookFile = bookFiles[0];
			if (!firstBookFile) {
				throw new Error("No book files found");
			}

			const content = readFileSync(
				join(firstSeriesPath, firstBookFile),
				"utf-8",
			);

			// Should contain wikilink to series
			expect(content).toMatch(/\*\*Series:\*\*\s*\[\[.+\]\]/);
		}).pipe(
			Effect.provide(HierarchicalSyncer.Default),
			Effect.provide(KavitaClientLayer),
			Effect.provide(createFilesystemAdapter(TEST_OUTPUT_DIR)),
			Effect.provide(TestConfigLayer),
		),
	);
});
