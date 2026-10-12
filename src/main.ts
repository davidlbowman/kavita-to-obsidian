/**
 * Kavita Sync plugin entry point.
 *
 * @module
 */
import { Effect, Fiber } from "effect";
import { Notice, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	decodePluginSettings,
	type PluginSettings,
} from "./schemas.js";
import { ObsidianHttpClient } from "./services/ObsidianHttpClient.js";
import { runSync } from "./sync.js";
import { KavitaSettingTab } from "./ui/SettingsTab.js";

export default class KavitaSyncPlugin extends Plugin {
	override settings: PluginSettings = DEFAULT_SETTINGS;
	private running: Fiber.Fiber<void> | undefined;

	override async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon("book-open", "Sync annotations", () => this.sync());
		this.addCommand({
			id: "sync-kavita-annotations",
			name: "Sync annotations",
			callback: () => this.sync(),
		});
		this.addSettingTab(new KavitaSettingTab(this.app, this));
	}

	override async onExternalSettingsChange(): Promise<void> {
		await this.loadSettings();
	}

	override onunload(): void {
		if (this.running !== undefined) {
			Effect.runFork(Fiber.interrupt(this.running));
		}
	}

	private async loadSettings(): Promise<void> {
		this.settings = decodePluginSettings((await this.loadData()) ?? {});
	}

	async updateSettings(patch: Partial<PluginSettings>): Promise<void> {
		this.settings = { ...this.settings, ...patch };
		await this.saveData(this.settings);
	}

	private sync(): void {
		if (this.running !== undefined) {
			new Notice("A sync is already running.");
			return;
		}
		new Notice("Syncing annotations…");
		const fiber = Effect.runFork(
			runSync(this.settings, this.app, ObsidianHttpClient),
		);
		this.running = fiber;
		fiber.addObserver(() => {
			this.running = undefined;
		});
	}
}
