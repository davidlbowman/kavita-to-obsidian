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
	includeTags: boolean;
	tagPrefix: string;
	includeWikilinks: boolean;
}

export default class KavitaToObsidianPlugin extends Plugin {
	settings: PluginSettingsData = { ...DEFAULT_SETTINGS };

	override async onload() {
		await this.loadSettings();

		this.addRibbonIcon("book-open", "Sync annotations", () => {
			this.syncAnnotations();
		});

		this.addCommand({
			id: "sync-kavita-annotations",
			name: "Sync annotations",
			callback: () => {
				this.syncAnnotations();
			},
		});

		this.addSettingTab(new KavitaSettingTab(this.app, this));
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<PluginSettingsData> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Run the annotation sync using Effect.
	 */
	private syncAnnotations() {
		if (!this.settings.kavitaUrl) {
			new Notice("Please configure server URL in plugin settings");
			return;
		}
		if (!this.settings.kavitaApiKey) {
			new Notice("Please configure API key in plugin settings");
			return;
		}

		new Notice("Syncing annotations…");

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
			.catch((error: unknown) => {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				new Notice(`Sync failed: ${message}`);
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

		new Setting(containerEl).setName("Kavita to Obsidian").setHeading();

		new Setting(containerEl)
			.setName("Kavita URL")
			.setDesc("The URL of your Kavita server (e.g., http://localhost:5000).")
			.addText((text) =>
				text
					.setPlaceholder("Enter URL")
					.setValue(this.plugin.settings.kavitaUrl)
					.onChange(async (value) => {
						this.plugin.settings.kavitaUrl = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Kavita API key")
			.setDesc("API key for your server.")
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
			.setName("Output path")
			.setDesc("Path to the Markdown file where annotations will be saved.")
			.addText((text) =>
				text
					.setPlaceholder("Enter file path")
					.setValue(this.plugin.settings.outputPath ?? "kavita-annotations.md")
					.onChange(async (value) => {
						this.plugin.settings.outputPath = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include comments")
			.setDesc("Include your comments and notes with each annotation.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeComments ?? true)
					.onChange(async (value) => {
						this.plugin.settings.includeComments = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include spoilers")
			.setDesc("Include annotations marked as spoilers.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeSpoilers ?? false)
					.onChange(async (value) => {
						this.plugin.settings.includeSpoilers = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Formatting").setHeading();

		new Setting(containerEl)
			.setName("Include tags")
			.setDesc(
				"Generate Obsidian tags from series, author, and library names (e.g., #kavita/series/the-great-gatsby).",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeTags ?? true)
					.onChange(async (value) => {
						this.plugin.settings.includeTags = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Tag prefix")
			.setDesc(
				"Optional prefix for genre tags (e.g., 'genre/' produces #genre/fiction).",
			)
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(this.plugin.settings.tagPrefix ?? "")
					.onChange(async (value) => {
						this.plugin.settings.tagPrefix = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include wikilinks")
			.setDesc(
				"Create [[wikilinks]] for series and author names to link to existing notes.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.includeWikilinks ?? true)
					.onChange(async (value) => {
						this.plugin.settings.includeWikilinks = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
