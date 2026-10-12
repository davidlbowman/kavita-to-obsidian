/**
 * Wire the services together to sync or to check a connection.
 *
 * @module
 */
import { Effect, Layer } from "effect";
import type * as HttpClient from "effect/http/HttpClient";
import type { ConnectionInfo, PluginSettings, SyncSummary } from "./schemas.js";
import { KavitaClient } from "./services/KavitaClient.js";
import { NoteSync } from "./services/NoteSync.js";
import type { ObsidianApp } from "./services/ObsidianApp.js";
import { ObsidianVault } from "./services/ObsidianVault.js";
import { PluginConfig } from "./services/PluginConfig.js";

/**
 * Everything a sync needs, built from settings, the app, and an HTTP client.
 *
 * `settings.kavitaApiKey` must already hold the resolved auth key.
 *
 * @since 2.0.0
 * @category Sync
 */
export const syncLayer = (
	settings: PluginSettings,
	app: ObsidianApp["Service"],
	http: Layer.Layer<HttpClient.HttpClient>,
) =>
	NoteSync.layerNoDeps.pipe(
		Layer.provide(
			Layer.mergeAll(KavitaClient.layerNoDeps, ObsidianVault.layer(app)),
		),
		Layer.provide(PluginConfig.fromSettings(settings)),
		Layer.provide(http),
	);

/**
 * Sync highlights into the vault.
 *
 * @since 2.0.0
 * @category Sync
 */
export const runSync = (
	settings: PluginSettings,
	app: ObsidianApp["Service"],
	http: Layer.Layer<HttpClient.HttpClient>,
) =>
	Effect.gen(function* () {
		return yield* (yield* NoteSync).sync;
	}).pipe(Effect.provide(syncLayer(settings, app, http)));

/**
 * Connect, then report who the auth key belongs to and what it can sync.
 *
 * @since 2.0.0
 * @category Sync
 */
export const checkConnection = (
	settings: PluginSettings,
	http: Layer.Layer<HttpClient.HttpClient>,
) =>
	Effect.gen(function* () {
		const kavita = yield* KavitaClient;
		const annotations = yield* kavita.annotations;
		const info: ConnectionInfo = {
			username: kavita.user.username ?? "unknown user",
			kavitaVersion: kavita.user.kavitaVersion ?? "unknown version",
			highlights: annotations.length,
			books: new Set(annotations.map((a) => a.chapterId)).size,
		};
		return info;
	}).pipe(
		Effect.provide(
			KavitaClient.layerNoDeps.pipe(
				Layer.provide(PluginConfig.fromSettings(settings)),
				Layer.provide(http),
			),
		),
	);

/**
 * "3 books" / "1 book".
 *
 * @since 2.0.0
 * @category Sync
 */
export const plural = (count: number, noun: string): string =>
	`${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * One line describing what a sync did.
 *
 * @since 2.0.0
 * @category Sync
 */
export const describeSummary = (summary: SyncSummary): string => {
	const parts = [
		`${plural(summary.highlights, "highlight")} from ${plural(summary.books, "book")}`,
	];
	if (summary.newHighlights > 0) parts.push(`${summary.newHighlights} new`);
	if (summary.notesDeleted > 0) {
		parts.push(`${plural(summary.notesDeleted, "note")} removed`);
	}
	if (
		summary.newHighlights === 0 &&
		summary.notesCreated === 0 &&
		summary.notesUpdated === 0 &&
		summary.notesDeleted === 0
	) {
		parts.push("everything up to date");
	}
	return parts.join(" · ");
};

/**
 * One line describing a working connection.
 *
 * @since 2.0.0
 * @category Sync
 */
export const describeConnection = (info: ConnectionInfo): string =>
	`Connected as ${info.username} · Kavita ${info.kavitaVersion} · ${plural(info.highlights, "highlight")} in ${plural(info.books, "book")}`;

/**
 * The user's most recent highlights, for the template preview.
 *
 * @since 2.0.0
 * @category Sync
 */
export const recentHighlights = (
	settings: PluginSettings,
	http: Layer.Layer<HttpClient.HttpClient>,
	count: number,
) =>
	Effect.gen(function* () {
		const annotations = yield* (yield* KavitaClient).annotations;
		return annotations
			.toSorted((a, b) => b.createdUtc.localeCompare(a.createdUtc))
			.slice(0, count);
	}).pipe(
		Effect.provide(
			KavitaClient.layerNoDeps.pipe(
				Layer.provide(PluginConfig.fromSettings(settings)),
				Layer.provide(http),
			),
		),
	);

/**
 * "just now", "5 minutes ago", "3 hours ago", "2 days ago".
 *
 * @since 2.0.0
 * @category Sync
 */
export const timeAgo = (iso: string, now: number): string => {
	const then = Date.parse(iso);
	if (Number.isNaN(then)) return "never";
	const minutes = Math.round((now - then) / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	const days = Math.round(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
};
