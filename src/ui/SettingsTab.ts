/**
 * Plugin settings tab.
 *
 * @module
 */
import { Result, Schema } from "effect";
import { type App, Notice, PluginSettingTab, Setting } from "obsidian";
import { validateTemplate } from "../formatters/template.js";
import type KavitaSyncPlugin from "../main.js";
import {
	DEFAULT_ANNOTATION_TEMPLATE,
	DEFAULT_SETTINGS,
	ExportMode,
} from "../schemas.js";

const isExportMode = Schema.is(ExportMode);

/**
 * Settings UI for connection, export layout, content, and formatting.
 *
 * @since 0.0.1
 * @category UI
 */
export class KavitaSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: KavitaSyncPlugin,
	) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl } = this;
		const { settings } = this.plugin;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Kavita URL")
			.setDesc("The address of your server, including the port.")
			.addText((text) =>
				text
					.setPlaceholder("Enter URL")
					.setValue(settings.kavitaUrl)
					.onChange((kavitaUrl) =>
						this.plugin.updateSettings({ kavitaUrl: kavitaUrl.trim() }),
					),
			);

		new Setting(containerEl)
			.setName("Kavita auth key")
			.setDesc(
				"Create one under user settings → manage auth keys. Older servers call this the API key.",
			)
			.addText((text) => {
				text
					.setPlaceholder("Enter your auth key")
					.setValue(settings.kavitaApiKey)
					.onChange((kavitaApiKey) =>
						this.plugin.updateSettings({ kavitaApiKey: kavitaApiKey.trim() }),
					);
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
					.setValue(settings.exportMode)
					.onChange(async (exportMode) => {
						if (isExportMode(exportMode)) {
							await this.plugin.updateSettings({ exportMode });
							this.display();
						}
					}),
			);

		if (settings.exportMode === "single-file") {
			new Setting(containerEl)
				.setName("Output path")
				.setDesc("Path to the Markdown file where annotations will be saved.")
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.outputPath)
						.setValue(settings.outputPath)
						.onChange((outputPath) =>
							this.plugin.updateSettings({ outputPath }),
						),
				);
		} else {
			new Setting(containerEl)
				.setName("Root folder")
				.setDesc("Name of the folder where series folders will be created.")
				.addText((text) =>
					text
						.setPlaceholder(DEFAULT_SETTINGS.rootFolderName)
						.setValue(settings.rootFolderName)
						.onChange((rootFolderName) =>
							this.plugin.updateSettings({ rootFolderName }),
						),
				);

			new Setting(containerEl)
				.setName("Delete orphaned files")
				.setDesc(
					"Move notes to the trash when their annotations no longer exist. Only notes created by this plugin are touched.",
				)
				.addToggle((toggle) =>
					toggle
						.setValue(settings.deleteOrphanedFiles)
						.onChange((deleteOrphanedFiles) =>
							this.plugin.updateSettings({ deleteOrphanedFiles }),
						),
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
					.setValue(settings.includeComments)
					.onChange((includeComments) =>
						this.plugin.updateSettings({ includeComments }),
					),
			);

		new Setting(containerEl)
			.setName("Include spoilers")
			.setDesc("Include annotations marked as spoilers.")
			.addToggle((toggle) =>
				toggle
					.setValue(settings.includeSpoilers)
					.onChange((includeSpoilers) =>
						this.plugin.updateSettings({ includeSpoilers }),
					),
			);

		new Setting(containerEl).setName("Formatting").setHeading();

		new Setting(containerEl)
			.setName("Include tags")
			.setDesc(
				"Generate Obsidian tags from series, author, and library names (e.g., #kavita/series/the-great-gatsby).",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.includeTags)
					.onChange((includeTags) =>
						this.plugin.updateSettings({ includeTags }),
					),
			);

		new Setting(containerEl)
			.setName("Tag prefix")
			.setDesc(
				"Optional prefix for genre tags (e.g., 'genre/' produces #genre/fiction).",
			)
			.addText((text) =>
				text
					.setPlaceholder("")
					.setValue(settings.tagPrefix)
					.onChange((tagPrefix) => this.plugin.updateSettings({ tagPrefix })),
			);

		new Setting(containerEl)
			.setName("Include wikilinks")
			.setDesc(
				"Create [[wikilinks]] for series and author names to link to existing notes.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.includeWikilinks)
					.onChange((includeWikilinks) =>
						this.plugin.updateSettings({ includeWikilinks }),
					),
			);

		new Setting(containerEl)
			.setName("Annotation template")
			.setDesc(
				"Customize how each annotation is formatted. Variables: {{blockquote}} (blockquoted text), {{selectedText}} (raw text), {{comment}}, {{pageNumber}}, {{chapterTitle}}, {{seriesName}}, {{createdUtc}}. Use {{#if variable}}...{{/if}} for conditionals.",
			)
			.addTextArea((text) => {
				text
					.setPlaceholder(DEFAULT_ANNOTATION_TEMPLATE)
					.setValue(settings.annotationTemplate)
					.onChange(async (annotationTemplate) => {
						const validation = validateTemplate(annotationTemplate);
						if (Result.isFailure(validation)) {
							new Notice(`Template error: ${validation.failure}`);
							return;
						}
						await this.plugin.updateSettings({ annotationTemplate });
					});
				text.inputEl.rows = 8;
				text.inputEl.cols = 40;
			})
			.addExtraButton((button) =>
				button
					.setIcon("reset")
					.setTooltip("Reset to default template")
					.onClick(async () => {
						await this.plugin.updateSettings({
							annotationTemplate: DEFAULT_ANNOTATION_TEMPLATE,
						});
						this.display();
					}),
			);
	}
}
