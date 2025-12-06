/**
 * Annotation syncer service for syncing Kavita annotations to Obsidian.
 *
 * @module
 */
import { Effect } from "effect";
import type { KavitaNetworkError, ObsidianWriteError } from "../errors.js";
import { toMarkdown } from "../formatters/markdown.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianAdapter } from "./ObsidianAdapter.js";
import { PluginConfig } from "./PluginConfig.js";

/**
 * Result of a sync operation.
 *
 * @since 0.0.1
 * @category Syncer
 */
export interface SyncResult {
	readonly count: number;
	readonly outputPath: string;
}

/**
 * Annotation syncer service.
 *
 * Orchestrates fetching annotations from Kavita and writing them to Obsidian.
 *
 * @since 0.0.1
 * @category Services
 */
export class AnnotationSyncer extends Effect.Service<AnnotationSyncer>()(
	"AnnotationSyncer",
	{
		accessors: true,
		effect: Effect.gen(function* () {
			const kavita = yield* KavitaClient;
			const obsidian = yield* ObsidianAdapter;
			const config = yield* PluginConfig;

			/**
			 * Sync all annotations to a single file.
			 *
			 * @since 0.0.1
			 */
			const syncToFile: Effect.Effect<
				SyncResult,
				KavitaNetworkError | ObsidianWriteError
			> = Effect.gen(function* () {
				const annotations = yield* kavita.fetchAllAnnotations;

				const markdown = toMarkdown(annotations, {
					includeComments: config.includeComments,
					includeSpoilers: config.includeSpoilers,
				});

				yield* obsidian.writeFile(config.outputPath, markdown);

				return {
					count: annotations.length,
					outputPath: config.outputPath,
				};
			});

			return { syncToFile };
		}),
	},
) {}
