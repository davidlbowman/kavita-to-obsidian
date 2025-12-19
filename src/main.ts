/**
 * Kavita to Obsidian plugin entry point.
 *
 * @module
 */
import { Effect, Layer, Match } from "effect";
import { type App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { SyncError } from "./errors.js";
import { DEFAULT_SETTINGS } from "./schemas.js";
import { AnnotationSyncer } from "./services/AnnotationSyncer.js";
import { HierarchicalSyncer } from "./services/HierarchicalSyncer.js";
import { KavitaClient } from "./services/KavitaClient.js";
import { ObsidianAdapter } from "./services/ObsidianAdapter.js";
import { ObsidianApp } from "./services/ObsidianApp.js";
import { ObsidianHttpClient } from "./services/ObsidianHttpClient.js";
import { PluginConfig } from "./services/PluginConfig.js";

const TROUBLESHOOTING_URL =
	"https://github.com/davidlbowman/kavita-to-obsidian/blob/main/TROUBLESHOOTING.md";

/**
 * Show user-friendly error notices based on error type.
 *
 * @since 1.2.0
 */
const showErrorNotice = (error: SyncError): void => {
	Match.value(error).pipe(
		Match.tag("KavitaAuthError", () => {
			new Notice("Authentication failed. Check your API key in settings.");
			new Notice(`See: ${TROUBLESHOOTING_URL}#authentication-failed`, 8000);
		}),
		Match.tag("KavitaNetworkError", (e) => {
			if (e.statusCode === 401 || e.statusCode === 403) {
				new Notice("Access denied. Your API key may be invalid or expired.");
				new Notice(
					`See: ${TROUBLESHOOTING_URL}#network-error-status-401403`,
					8000,
				);
			} else if (e.statusCode === 404) {
				new Notice("Kavita server not found. Check your URL in settings.");
				new Notice(
					`See: ${TROUBLESHOOTING_URL}#network-error-status-404`,
					8000,
				);
			} else {
				new Notice(`Cannot reach Kavita: ${e.message}`);
				new Notice(`See: ${TROUBLESHOOTING_URL}#connection-refused`, 8000);
			}
		}),
		Match.tag("KavitaParseError", () => {
			new Notice("Unexpected response - update plugin or server version.");
			new Notice(`See: ${TROUBLESHOOTING_URL}#failed-to-parse-response`, 8000);
		}),
		Match.tag("ObsidianWriteError", (e) => {
			new Notice(`Cannot write to ${e.path}. Check the path is valid.`);
			new Notice(`See: ${TROUBLESHOOTING_URL}#failed-to-write-file`, 8000);
		}),
		Match.tag("ObsidianFolderError", (e) => {
			new Notice(`Folder error: ${e.path}. Check folder name is valid.`);
			new Notice(`See: ${TROUBLESHOOTING_URL}#folder-operation-failed`, 8000);
		}),
		Match.tag("ObsidianFileNotFoundError", (e) => {
			new Notice(`File not found: ${e.path}`);
		}),
		Match.exhaustive,
	);
};

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
	exportMode: "single-file" | "hierarchical";
	rootFolderName: string;
	deleteOrphanedFiles: boolean;
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

		const isHierarchical = this.settings.exportMode === "hierarchical";

		const ConfigLayer = PluginConfig.fromSettings(this.settings);
		const ObsidianAppLayer = Layer.succeed(ObsidianApp, this.app);

		const ObsidianAdapterLayer = ObsidianAdapter.Default.pipe(
			Layer.provide(ObsidianAppLayer),
		);

		const KavitaClientLayer = KavitaClient.DefaultWithoutDependencies.pipe(
			Layer.provide(ConfigLayer),
			Layer.provide(ObsidianHttpClient),
		);

		if (isHierarchical) {
			const program = Effect.gen(function* () {
				const syncer = yield* HierarchicalSyncer;
				return yield* syncer.syncAll;
			});

			const SyncerLayer = HierarchicalSyncer.Default.pipe(
				Layer.provide(KavitaClientLayer),
				Layer.provide(ObsidianAdapterLayer),
				Layer.provide(ConfigLayer),
			);

			const runnable = program.pipe(
				Effect.provide(SyncerLayer),
				Effect.match({
					onSuccess: (result) => {
						new Notice(
							`Synced ${result.totalAnnotations} annotations across ${result.seriesCount} series (${result.bookCount} books)`,
						);
					},
					onFailure: (error) => {
						showErrorNotice(error);
					},
				}),
			);

			void Effect.runPromise(runnable);
		} else {
			const program = Effect.gen(function* () {
				const syncer = yield* AnnotationSyncer;
				return yield* syncer.syncToFile;
			});

			const SyncerLayer = AnnotationSyncer.Default.pipe(
				Layer.provide(KavitaClientLayer),
				Layer.provide(ObsidianAdapterLayer),
				Layer.provide(ConfigLayer),
			);

			const runnable = program.pipe(
				Effect.provide(SyncerLayer),
				Effect.match({
					onSuccess: (result) => {
						new Notice(
							`Synced ${result.count} annotations to ${result.outputPath}`,
						);
					},
					onFailure: (error) => {
						showErrorNotice(error);
					},
				}),
			);

			void Effect.runPromise(runnable);
		}
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

		new Setting(containerEl).setName("Export").setHeading();

		new Setting(containerEl)
			.setName("Export mode")
			.setDesc(
				"Single file exports all annotations to one file. Hierarchical creates folders for each series with separate book files.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("single-file", "Single file")
					.addOption("hierarchical", "Hierarchical folders")
					.setValue(this.plugin.settings.exportMode ?? "single-file")
					.onChange(async (value) => {
						this.plugin.settings.exportMode = value as
							| "single-file"
							| "hierarchical";
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.exportMode === "single-file") {
			new Setting(containerEl)
				.setName("Output path")
				.setDesc("Path to the Markdown file where annotations will be saved.")
				.addText((text) =>
					text
						.setPlaceholder("Enter file path")
						.setValue(
							this.plugin.settings.outputPath ?? "kavita-annotations.md",
						)
						.onChange(async (value) => {
							this.plugin.settings.outputPath = value;
							await this.plugin.saveSettings();
						}),
				);
		} else {
			new Setting(containerEl)
				.setName("Root folder")
				.setDesc("Name of the folder where series folders will be created.")
				.addText((text) =>
					text
						.setPlaceholder("Enter folder name")
						.setValue(
							this.plugin.settings.rootFolderName ?? "Kavita Annotations",
						)
						.onChange(async (value) => {
							this.plugin.settings.rootFolderName = value;
							await this.plugin.saveSettings();
						}),
				);

			new Setting(containerEl)
				.setName("Delete orphaned files")
				.setDesc(
					"Automatically remove files when their source annotations are deleted.",
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.deleteOrphanedFiles ?? true)
						.onChange(async (value) => {
							this.plugin.settings.deleteOrphanedFiles = value;
							await this.plugin.saveSettings();
						}),
				);

			containerEl.createEl("p", {
				text: "Files in hierarchical mode are fully managed by this plugin and regenerated on each sync. Any manual edits will be lost.",
				cls: "setting-item-description",
			});
		}

		new Setting(containerEl).setName("Content").setHeading();

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
