/**
 * Wire the services together and run one sync.
 *
 * @module
 */
import { Effect, Layer } from "effect";
import type { HttpClient } from "effect/http";
import { Notice } from "obsidian";
import type { PluginSettings } from "./schemas.js";
import { AnnotationSyncer } from "./services/AnnotationSyncer.js";
import { HierarchicalSyncer } from "./services/HierarchicalSyncer.js";
import { KavitaClient } from "./services/KavitaClient.js";
import type { ObsidianApp } from "./services/ObsidianApp.js";
import { ObsidianVault } from "./services/ObsidianVault.js";
import { PluginConfig } from "./services/PluginConfig.js";
import { showErrorNotice } from "./ui/errorNotice.js";

/**
 * Everything a sync needs, built from settings, the app, and an HTTP client.
 *
 * @since 2.0.0
 * @category Sync
 */
export const syncLayer = (
	settings: PluginSettings,
	app: ObsidianApp["Service"],
	http: Layer.Layer<HttpClient.HttpClient>,
) =>
	Layer.mergeAll(
		AnnotationSyncer.layerNoDeps,
		HierarchicalSyncer.layerNoDeps,
	).pipe(
		Layer.provide(
			Layer.mergeAll(KavitaClient.layerNoDeps, ObsidianVault.layer(app)),
		),
		Layer.provideMerge(PluginConfig.fromSettings(settings)),
		Layer.provide(http),
	);

/**
 * Sync in the configured export mode and summarize the outcome.
 *
 * @since 2.0.0
 * @category Sync
 */
export const syncAnnotations = Effect.gen(function* () {
	const { exportMode } = yield* PluginConfig;
	if (exportMode === "single-file") {
		const result = yield* (yield* AnnotationSyncer).sync;
		return `Synced ${result.annotationCount} annotations to ${result.outputPath}`;
	}
	const result = yield* (yield* HierarchicalSyncer).sync;
	const removed =
		result.filesDeleted > 0
			? `, removed ${result.filesDeleted} orphaned notes`
			: "";
	return `Synced ${result.annotationCount} annotations across ${result.seriesCount} series (${result.bookCount} books)${removed}`;
});

/**
 * Run a sync and report the outcome as Obsidian notices.
 *
 * Never fails: typed errors become actionable notices, and defects are
 * logged to the developer console.
 *
 * @since 2.0.0
 * @category Sync
 */
export const runSync = (
	settings: PluginSettings,
	app: ObsidianApp["Service"],
	http: Layer.Layer<HttpClient.HttpClient>,
): Effect.Effect<void> =>
	syncAnnotations.pipe(
		Effect.provide(syncLayer(settings, app, http)),
		Effect.match({
			onFailure: showErrorNotice,
			onSuccess: (summary) => {
				new Notice(summary);
			},
		}),
		Effect.catchDefect((defect) =>
			Effect.sync(() => {
				console.error("Kavita sync failed unexpectedly", defect);
				new Notice("Sync failed unexpectedly. Check the developer console.");
			}),
		),
	);
