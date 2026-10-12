/**
 * Kavita Sync plugin entry point.
 *
 * @module
 */
import { Effect } from "effect";
import { Platform, Plugin, TFile } from "obsidian";
import { buildLibraryPath } from "./formatters/paths.js";
import {
	type Annotation,
	DEFAULT_SETTINGS,
	decodePluginSettings,
	type PluginSettings,
} from "./schemas.js";
import { ObsidianHttpClient } from "./services/ObsidianHttpClient.js";
import { recentHighlights } from "./sync.js";
import { KavitaSettingTab, type SettingsHost } from "./ui/SettingsTab.js";
import { SetupModal, type SetupHost } from "./ui/SetupModal.js";
import {
	type ConnectionResult,
	SyncController,
	type SyncHost,
} from "./ui/SyncController.js";

/**
 * Name of the secret holding the Kavita auth key.
 *
 * @since 2.0.0
 * @category Constants
 */
export const AUTH_KEY_SECRET = "kavita-sync-auth-key";

const STATUS_REFRESH_MS = 60_000;

export default class KavitaSyncPlugin
	extends Plugin
	implements SyncHost, SettingsHost, SetupHost
{
	override settings: PluginSettings = DEFAULT_SETTINGS;
	private readonly controller = new SyncController(this);
	private autoSyncTimer: number | undefined;

	override async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new KavitaSettingTab(this.app, this, this));

		this.addRibbonIcon("book-open", "Sync Kavita highlights", () =>
			this.controller.sync("manual"),
		);

		this.addCommand({
			id: "sync-highlights",
			name: "Sync highlights",
			icon: "refresh-cw",
			callback: () => this.controller.sync("manual"),
		});
		this.addCommand({
			id: "connect",
			name: "Connect to Kavita",
			icon: "plug",
			callback: () => this.openSetup(),
		});
		this.addCommand({
			id: "open-in-kavita",
			name: "Open this book in Kavita",
			icon: "external-link",
			checkCallback: (checking) => {
				const url = this.activeKavitaUrl();
				if (url === undefined) return false;
				if (!checking) window.open(url);
				return true;
			},
		});
		this.addCommand({
			id: "open-library",
			name: "Open library",
			icon: "library",
			checkCallback: (checking) => {
				const library = this.app.vault.getAbstractFileByPath(
					buildLibraryPath(this.settings.rootFolderName),
				);
				if (!(library instanceof TFile)) return false;
				if (!checking) void this.app.workspace.getLeaf(false).openFile(library);
				return true;
			},
		});

		this.registerObsidianProtocolHandler("kavita-sync", () =>
			this.controller.sync("manual"),
		);

		if (!Platform.isMobile) {
			this.controller.attachStatusBar(this.addStatusBarItem());
			this.registerInterval(
				window.setInterval(
					() => this.controller.refreshStatus(),
					STATUS_REFRESH_MS,
				),
			);
		}

		this.app.workspace.onLayoutReady(() => {
			if (!this.isConfigured() && !this.settings.setupDismissed) {
				this.openSetup();
			} else if (this.settings.syncOnStartup) {
				this.controller.sync("automatic");
			}
		});
		this.scheduleAutoSync();
	}

	override async onExternalSettingsChange(): Promise<void> {
		await this.loadSettings();
		this.settingsChanged();
	}

	override onunload(): void {
		this.controller.stop();
	}

	private async loadSettings(): Promise<void> {
		const loaded = decodePluginSettings(await this.loadData());
		if (loaded.kavitaApiKey !== "" && loaded.authKeySecret === "") {
			this.app.secretStorage.setSecret(AUTH_KEY_SECRET, loaded.kavitaApiKey);
			this.settings = {
				...loaded,
				authKeySecret: AUTH_KEY_SECRET,
				kavitaApiKey: "",
			};
			await this.saveData(this.settings);
			return;
		}
		this.settings = loaded;
	}

	async updateSettings(patch: Partial<PluginSettings>): Promise<void> {
		this.settings = { ...this.settings, ...patch };
		await this.saveData(this.settings);
		this.controller.refreshStatus();
	}

	settingsChanged(): void {
		this.scheduleAutoSync();
		this.controller.refreshStatus();
	}

	private authKey(settings: PluginSettings): string {
		return settings.authKeySecret === ""
			? settings.kavitaApiKey
			: (this.app.secretStorage.getSecret(settings.authKeySecret) ?? "");
	}

	withAuthKey(settings: PluginSettings): PluginSettings {
		return { ...settings, kavitaApiKey: this.authKey(settings) };
	}

	resolvedSettings(): PluginSettings {
		return this.withAuthKey(this.settings);
	}

	isConfigured(): boolean {
		return (
			this.settings.kavitaUrl.trim() !== "" &&
			this.authKey(this.settings).trim() !== ""
		);
	}

	isSyncing(): boolean {
		return this.controller.isRunning;
	}

	openSetup(): void {
		new SetupModal(this.app, this).open();
	}

	syncNow(): void {
		this.controller.sync("manual");
	}

	checkConnection(settings: PluginSettings): Promise<ConnectionResult> {
		return this.controller.checkConnection(settings);
	}

	previewHighlights(): Promise<ReadonlyArray<Annotation>> {
		if (!this.isConfigured()) return Promise.resolve([]);
		return Effect.runPromise(
			recentHighlights(this.resolvedSettings(), ObsidianHttpClient, 3).pipe(
				Effect.orElseSucceed((): ReadonlyArray<Annotation> => []),
			),
		);
	}

	private activeKavitaUrl(): string | undefined {
		const file = this.app.workspace.getActiveFile();
		if (file === null) return undefined;
		const url: unknown =
			this.app.metadataCache.getFileCache(file)?.frontmatter?.kavita_url;
		return typeof url === "string" && url.startsWith("http") ? url : undefined;
	}

	private scheduleAutoSync(): void {
		if (this.autoSyncTimer !== undefined) {
			window.clearInterval(this.autoSyncTimer);
			this.autoSyncTimer = undefined;
		}
		if (this.settings.syncInterval > 0) {
			this.autoSyncTimer = window.setInterval(
				() => this.controller.sync("automatic"),
				this.settings.syncInterval * 60_000,
			);
			this.registerInterval(this.autoSyncTimer);
		}
	}
}
