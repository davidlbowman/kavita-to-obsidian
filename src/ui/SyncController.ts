/**
 * Runs syncs and connection checks for the UI, and reports on them through a
 * live notice and the status bar.
 *
 * @module
 */
import { Effect, Exit, Fiber, Layer, Option } from "effect";
import { type App, Notice, setIcon, setTooltip, TFile } from "obsidian";
import type { SyncError } from "../errors.js";
import type {
	ConnectionInfo,
	PluginSettings,
	SyncSummary,
} from "../schemas.js";
import { ObsidianHttpClient } from "../services/ObsidianHttpClient.js";
import { SyncProgress } from "../services/SyncProgress.js";
import {
	checkConnection,
	describeConnection,
	describeSummary,
	runSync,
	timeAgo,
} from "../sync.js";
import {
	describeSyncError,
	type ErrorNoticeContent,
	TROUBLESHOOTING_URL,
} from "./errorNotice.js";

/**
 * Where a sync was started from. Automatic syncs stay quiet unless something
 * new arrived or something went wrong.
 *
 * @since 2.0.0
 * @category Sync Controller
 */
export type SyncOrigin = "manual" | "automatic";

/**
 * Result of a connection check, for settings and setup.
 *
 * @since 2.0.0
 * @category Sync Controller
 */
export type ConnectionResult =
	| { readonly ok: true; readonly info: ConnectionInfo; readonly text: string }
	| { readonly ok: false; readonly error: ErrorNoticeContent };

/**
 * The plugin surface the controller needs.
 *
 * @since 2.0.0
 * @category Sync Controller
 */
export interface SyncHost {
	readonly app: App;
	readonly settings: PluginSettings;
	resolvedSettings(): PluginSettings;
	isConfigured(): boolean;
	openSetup(): void;
	updateSettings(patch: Partial<PluginSettings>): Promise<void>;
}

const NOTICE_LINGER_MS = 8000;

const troubleshootingLink = (fragment: DocumentFragment, anchor: string) => {
	fragment.createEl("br");
	fragment.createEl("a", {
		text: "How to fix this",
		href: `${TROUBLESHOOTING_URL}${anchor}`,
	});
};

/**
 * Runs syncs, keeps the status bar current, and checks connections.
 *
 * @since 2.0.0
 * @category Sync Controller
 */
export class SyncController {
	private running: Fiber.Fiber<void> | undefined;
	private statusEl: HTMLElement | undefined;
	private lastError: string | undefined;

	constructor(private readonly host: SyncHost) {}

	/**
	 * Whether a sync is in progress.
	 */
	get isRunning(): boolean {
		return this.running !== undefined;
	}

	/**
	 * Attach the desktop status bar item.
	 */
	attachStatusBar(el: HTMLElement): void {
		this.statusEl = el;
		el.addClass("kavita-sync-status", "mod-clickable");
		el.addEventListener("click", () => this.sync("manual"));
		this.refreshStatus();
	}

	/**
	 * Re-render the status bar item.
	 */
	refreshStatus(): void {
		const el = this.statusEl;
		if (el === undefined) return;
		el.empty();
		const icon = el.createSpan({ cls: "kavita-sync-status-icon" });
		const label = el.createSpan();
		const { lastSyncedAt, lastSyncSummary } = this.host.settings;
		if (this.isRunning) {
			setIcon(icon, "refresh-cw");
			icon.addClass("is-spinning");
			label.setText("Kavita · syncing…");
			setTooltip(el, "Syncing highlights from Kavita");
		} else if (this.lastError !== undefined) {
			setIcon(icon, "alert-triangle");
			label.setText("Kavita · sync failed");
			setTooltip(el, `${this.lastError}\nSelect to try again.`);
		} else if (!this.host.isConfigured()) {
			setIcon(icon, "book-open");
			label.setText("Kavita · set up");
			setTooltip(el, "Select to connect to your Kavita server");
		} else {
			setIcon(icon, "book-open");
			label.setText(
				lastSyncedAt === ""
					? "Kavita · not synced yet"
					: `Kavita · ${timeAgo(lastSyncedAt, Date.now())}`,
			);
			setTooltip(
				el,
				lastSyncSummary === ""
					? "Select to sync highlights"
					: `${lastSyncSummary}\nSelect to sync again.`,
			);
		}
	}

	/**
	 * Sync now. Opens setup instead when the plugin isn't configured yet.
	 */
	sync(origin: SyncOrigin): void {
		if (this.isRunning) {
			if (origin === "manual") new Notice("A sync is already running.");
			return;
		}
		if (!this.host.isConfigured()) {
			if (origin === "manual") this.host.openSetup();
			return;
		}
		const notice =
			origin === "manual" ? new Notice("Connecting to Kavita…", 0) : undefined;
		const progress = Layer.succeed(SyncProgress, {
			report: (message: string) =>
				Effect.sync(() => notice?.setMessage(message)),
		});
		const fiber = Effect.runFork(
			runSync(
				this.host.resolvedSettings(),
				this.host.app,
				ObsidianHttpClient,
			).pipe(
				Effect.provide(progress),
				Effect.exit,
				Effect.flatMap((exit) =>
					Effect.promise(() => this.finish(exit, origin, notice)),
				),
			),
		);
		this.running = fiber;
		this.refreshStatus();
		fiber.addObserver(() => {
			this.running = undefined;
			this.refreshStatus();
		});
	}

	private async finish(
		exit: Exit.Exit<SyncSummary, SyncError>,
		origin: SyncOrigin,
		notice: Notice | undefined,
	): Promise<void> {
		if (Exit.isSuccess(exit)) {
			const summary = exit.value;
			const text = describeSummary(summary);
			this.lastError = undefined;
			await this.host.updateSettings({
				lastSyncedAt: new Date().toISOString(),
				lastSyncSummary: text,
			});
			if (origin === "automatic" && summary.newHighlights === 0) return;
			const message = createFragment((f) => {
				f.createSpan({ text: `Kavita: ${text}` });
				f.createEl("br");
				const open = f.createEl("a", { text: "Open", href: "#" });
				open.addEventListener("click", (event) => {
					event.preventDefault();
					void this.open(summary.openPath);
				});
			});
			const shown = notice ?? new Notice("", 0);
			shown.setMessage(message);
			window.setTimeout(() => shown.hide(), NOTICE_LINGER_MS);
			return;
		}
		const failure = Option.getOrUndefined(Exit.findErrorOption(exit));
		const content =
			failure === undefined
				? {
						message: "Sync failed unexpectedly. Check the developer console.",
						anchor: "",
					}
				: describeSyncError(failure);
		if (failure === undefined) {
			console.error("Kavita sync failed unexpectedly", exit.cause);
		}
		this.lastError = content.message;
		const message = createFragment((f) => {
			f.createSpan({ text: content.message });
			if (content.anchor !== "") troubleshootingLink(f, content.anchor);
		});
		const shown = notice ?? new Notice("", 0);
		shown.setMessage(message);
		window.setTimeout(() => shown.hide(), NOTICE_LINGER_MS * 2);
	}

	/**
	 * Open a note or library view by path.
	 */
	async open(path: string): Promise<void> {
		const file = this.host.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			await this.host.app.workspace.getLeaf(false).openFile(file);
		}
	}

	/**
	 * Check that settings connect, without syncing.
	 */
	async checkConnection(settings: PluginSettings): Promise<ConnectionResult> {
		const exit = await Effect.runPromiseExit(
			checkConnection(settings, ObsidianHttpClient),
		);
		if (Exit.isSuccess(exit)) {
			return {
				ok: true,
				info: exit.value,
				text: describeConnection(exit.value),
			};
		}
		const failure = Option.getOrUndefined(Exit.findErrorOption(exit));
		return {
			ok: false,
			error:
				failure === undefined
					? { message: "Connection check failed unexpectedly.", anchor: "" }
					: describeSyncError(failure),
		};
	}

	/**
	 * Stop a running sync, e.g. when the plugin unloads.
	 */
	stop(): void {
		if (this.running !== undefined) {
			Effect.runFork(Fiber.interrupt(this.running));
		}
	}
}
