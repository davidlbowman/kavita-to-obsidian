/**
 * Kavita to Obsidian plugin entry point.
 *
 * @module
 */
import { Effect, Layer } from "effect";
import { type App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./schemas.js";
import { AnnotationSyncer } from "./services/AnnotationSyncer.js";
import { KavitaClient } from "./services/KavitaClient.js";
import { ObsidianAdapter } from "./services/ObsidianAdapter.js";
import { ObsidianApp } from "./services/ObsidianApp.js";
import { ObsidianHttpClient } from "./services/ObsidianHttpClient.js";
import { PluginConfig } from "./services/PluginConfig.js";

/**
 * Mutable settings interface for plugin storage.
 */
interface PluginSettingsData {
	kavitaUrl: string;
	kavitaApiKey: string;
	outputPath: string;
	matchThreshold: number;
	includeComments: boolean;
	includeSpoilers: boolean;
}

export default class KavitaToObsidianPlugin extends Plugin {
	settings: PluginSettingsData = { ...DEFAULT_SETTINGS };

	override async onload() {
		await this.loadSettings();

		this.addRibbonIcon("book-open", "Sync Kavita Annotations", () => {
			this.syncAnnotations();
		});

		this.addCommand({
			id: "sync-kavita-annotations",
			name: "Sync Kavita Annotations",
			callback: () => {
				this.syncAnnotations();
			},
		});

		this.addSettingTab(new KavitaSettingTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Run the annotation sync using Effect.
	 */
	private syncAnnotations() {
		if (!this.settings.kavitaUrl) {
			new Notice("Please configure Kavita URL in settings");
			return;
		}
		if (!this.settings.kavitaApiKey) {
			new Notice("Please configure Kavita API key in settings");
			return;
		}

		new Notice("Syncing Kavita annotations...");

		const program = Effect.gen(function* () {
			const syncer = yield* AnnotationSyncer;
			return yield* syncer.syncToFile;
		});

		const ConfigLayer = PluginConfig.fromSettings(this.settings);
		const ObsidianAppLayer = Layer.succeed(ObsidianApp, this.app);

		const ObsidianAdapterLayer = ObsidianAdapter.Default.pipe(
			Layer.provide(ObsidianAppLayer),
		);

		const KavitaClientLayer = KavitaClient.DefaultWithoutDependencies.pipe(
			Layer.provide(ConfigLayer),
			Layer.provide(ObsidianHttpClient),
		);

		const SyncerLayer = AnnotationSyncer.Default.pipe(
			Layer.provide(KavitaClientLayer),
			Layer.provide(ObsidianAdapterLayer),
			Layer.provide(ConfigLayer),
		);

		const runnable = program.pipe(Effect.provide(SyncerLayer));

		Effect.runPromise(runnable)
			.then((result) => {
				new Notice(
					`Synced ${result.count} annotations to ${result.outputPath}`,
				);
			})
			.catch((error) => {
				console.error("Kavita sync error:", error);
				new Notice(`Sync failed: ${error.message ?? "Unknown error"}`);
			});
	}
}

class KavitaSettingTab extends PluginSettingTab {
	plugin: KavitaToObsidianPlugin;

	constructor(app: App, plugin: KavitaToObsidianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Kavita to Obsidian Settings" });

		new Setting(containerEl)
			.setName("Kavita URL")
			.setDesc("The URL of your Kavita server (e.g., http://localhost:5000)")
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:5000")
					.setValue(this.plugin.settings.kavitaUrl)
					.onChange(async (value) => {
						this.plugin.settings.kavitaUrl = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Kavita API Key")
			.setDesc(
				"Your Kavita API key (found in User Settings > 3rd Party Clients)",
			)
			.addText((text) => {
				text
					.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.kavitaApiKey)
					.onChange(async (value) => {
						this.plugin.settings.kavitaApiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.setAttribute("type", "password");
			});

		new Setting(containerEl)
			.setName("Output Path")
			.setDesc("Path to the markdown file where annotations will be saved")
			.addText((text) =>
				text
					.setPlaceholder("kavita-annotations.md")
					.setValue(this.plugin.settings.outputPath ?? "kavita-annotations.md")
					.onChange(async (value) => {
						this.plugin.settings.outputPath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include Comments")
			.setDesc("Include your comments/notes with each annotation")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeComments ?? true)
					.onChange(async (value) => {
						this.plugin.settings.includeComments = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include Spoilers")
			.setDesc("Include annotations marked as spoilers")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeSpoilers ?? false)
					.onChange(async (value) => {
						this.plugin.settings.includeSpoilers = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
