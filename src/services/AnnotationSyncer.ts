/**
 * Single-file export: every annotation in one markdown note.
 *
 * @module
 */
import { Context, DateTime, Effect, Layer } from "effect";
import { normalizePath } from "obsidian";
import type {
	KavitaError,
	ObsidianFolderError,
	ObsidianWriteError,
} from "../errors.js";
import { toMarkdown } from "../formatters/markdown.js";
import type { SingleFileSyncResult } from "../schemas.js";
import { fetchChapterInfo } from "./ChapterCatalog.js";
import { KavitaClient } from "./KavitaClient.js";
import { ObsidianVault } from "./ObsidianVault.js";
import { PluginConfig } from "./PluginConfig.js";

/**
 * Writes all annotations to the configured output note.
 *
 * @since 0.0.1
 * @category Services
 */
export class AnnotationSyncer extends Context.Service<
	AnnotationSyncer,
	{
		readonly sync: Effect.Effect<
			SingleFileSyncResult,
			KavitaError | ObsidianWriteError | ObsidianFolderError
		>;
	}
>()("kavita-to-obsidian/AnnotationSyncer") {
	/**
	 * Requires `KavitaClient`, `ObsidianVault`, and `PluginConfig`.
	 *
	 * @since 0.0.1
	 * @category Layers
	 */
	static readonly layerNoDeps = Layer.effect(
		AnnotationSyncer,
		Effect.gen(function* () {
			const kavita = yield* KavitaClient;
			const vault = yield* ObsidianVault;
			const config = yield* PluginConfig;

			const sync = Effect.gen(function* () {
				const annotations = yield* kavita.annotations;
				const chapterInfo = yield* fetchChapterInfo(
					kavita,
					annotations.map((a) => a.seriesId),
				);
				const updated = DateTime.formatIso(yield* DateTime.now);
				const outputPath = normalizePath(config.outputPath);
				const parent = outputPath.split("/").slice(0, -1).join("/");
				if (parent !== "") {
					yield* vault.ensureFolder(parent);
				}
				yield* vault.writeFile(
					outputPath,
					toMarkdown(annotations, config, chapterInfo, updated),
				);
				return { annotationCount: annotations.length, outputPath };
			}).pipe(Effect.withSpan("AnnotationSyncer.sync"));

			return AnnotationSyncer.of({ sync });
		}),
	);
}
