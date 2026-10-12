/**
 * Plugin settings, built with Obsidian's declarative settings API.
 *
 * @module
 */
import { Result } from "effect";
import {
	type App,
	type Plugin,
	PluginSettingTab,
	type SettingDefinitionItem,
} from "obsidian";
import { validateTemplate } from "../formatters/template.js";
import { timeAgo } from "../sync.js";
import {
	DEFAULT_ANNOTATION_TEMPLATE,
	DEFAULT_SETTINGS,
	decodePluginSettings,
	type PluginSettings,
} from "../schemas.js";
import type { ConnectionResult } from "./SyncController.js";
import { type TemplateHost, TemplatePage } from "./TemplatePage.js";

/**
 * What the settings tab needs from the plugin.
 *
 * @since 2.0.0
 * @category Settings
 */
export interface SettingsHost extends TemplateHost {
	isConfigured(): boolean;
	isSyncing(): boolean;
	withAuthKey(settings: PluginSettings): PluginSettings;
	checkConnection(settings: PluginSettings): Promise<ConnectionResult>;
	syncNow(): void;
	openSetup(): void;
	settingsChanged(): void;
}

const isHierarchical = (host: SettingsHost) => () =>
	host.settings.exportMode === "hierarchical";

const isSingleFile = (host: SettingsHost) => () =>
	host.settings.exportMode === "single-file";

const validateUrl = (value: string): string | undefined => {
	if (value.trim() === "") return undefined;
	if (!URL.canParse(value.trim()))
		return "Enter a full address like https://kavita.example.com";
	const { protocol } = new URL(value.trim());
	return protocol === "http:" || protocol === "https:"
		? undefined
		: "The address must start with http:// or https://";
};

/**
 * The plugin's settings tab.
 *
 * @since 0.0.1
 * @category Settings
 */
export class KavitaSettingTab extends PluginSettingTab {
	private connection: ConnectionResult | undefined;
	private checking = false;

	constructor(
		app: App,
		plugin: Plugin,
		private readonly host: SettingsHost,
	) {
		super(app, plugin);
		this.icon = "book-open";
	}

	override getControlValue(key: string): unknown {
		const value: unknown = Object.entries(this.host.settings).find(
			([name]) => name === key,
		)?.[1];
		return key === "syncInterval" ? String(value) : value;
	}

	override async setControlValue(key: string, value: unknown): Promise<void> {
		const next = decodePluginSettings({
			...this.host.settings,
			[key]: key === "syncInterval" ? Number(value) : value,
		});
		if (key === "kavitaUrl" || key === "authKeySecret") {
			this.connection = undefined;
		}
		await this.host.updateSettings(next);
		this.host.settingsChanged();
		this.refreshDomState();
	}

	override getSettingDefinitions(): Array<SettingDefinitionItem> {
		const host = this.host;
		return [
			{
				name: "Status",
				searchable: false,
				render: (setting) => {
					setting.settingEl.addClass("kavita-sync-status-row");
					setting.setName(this.statusTitle());
					setting.setDesc(this.statusDescription());
					if (this.connection?.ok === false) {
						setting.descEl.addClass("kavita-sync-error-text");
					}
					if (!host.isConfigured()) {
						setting.addButton((button) =>
							button
								.setButtonText("Set up")
								.setCta()
								.onClick(() => host.openSetup()),
						);
						return;
					}
					setting.addButton((button) =>
						button
							.setButtonText(this.checking ? "Testing…" : "Test connection")
							.setDisabled(this.checking)
							.onClick(() => void this.testConnection()),
					);
					setting.addButton((button) =>
						button
							.setButtonText(host.isSyncing() ? "Syncing…" : "Sync now")
							.setCta()
							.setDisabled(host.isSyncing())
							.onClick(() => {
								host.syncNow();
								window.setTimeout(() => this.update(), 250);
							}),
					);
				},
			},
			{
				name: "Server URL",
				desc: "The address you open Kavita at, including the port.",
				aliases: ["Kavita", "address", "host"],
				control: {
					type: "text",
					key: "kavitaUrl",
					placeholder: "https://kavita.example.com",
					validate: validateUrl,
				},
			},
			{
				name: "Auth key",
				desc: "In Kavita, open your user settings → manage auth keys. Older servers call it the API key. Stored in Obsidian's secure storage, not in the vault.",
				aliases: ["API key", "token", "password"],
				control: { type: "secret", key: "authKeySecret" },
			},
			{
				type: "group",
				heading: "Notes",
				items: [
					{
						name: "Layout",
						desc: "A note per book works best with links, graph view, and Bases.",
						control: {
							type: "dropdown",
							key: "exportMode",
							options: {
								hierarchical: "One note per book",
								"single-file": "One note for everything",
							},
						},
					},
					{
						name: "Folder",
						desc: "Book notes are filed by series inside this folder.",
						visible: isHierarchical(host),
						control: {
							type: "folder",
							key: "rootFolderName",
							placeholder: DEFAULT_SETTINGS.rootFolderName,
						},
					},
					{
						name: "Note",
						desc: "Path of the note that collects every highlight.",
						visible: isSingleFile(host),
						control: {
							type: "text",
							key: "outputPath",
							placeholder: DEFAULT_SETTINGS.outputPath,
						},
					},
					{
						name: "Download book covers",
						desc: "Shows each cover at the top of its note and in the library view.",
						visible: isHierarchical(host),
						control: { type: "toggle", key: "downloadCovers" },
					},
					{
						name: "Create a library view",
						desc: "Adds a base to the folder that shows your books as cover cards. It's created once and never overwritten.",
						aliases: ["Bases", "gallery"],
						visible: isHierarchical(host),
						control: { type: "toggle", key: "createLibraryView" },
					},
					{
						name: "Remove notes for deleted highlights",
						desc: "When every highlight in a book is gone from Kavita, move its note to the trash. Only notes this plugin created are touched.",
						aliases: ["orphan", "delete"],
						visible: isHierarchical(host),
						control: { type: "toggle", key: "deleteOrphanedFiles" },
					},
				],
			},
			{
				type: "group",
				heading: "Highlights",
				items: [
					{
						name: "Include your comments",
						desc: "Show the notes you wrote on highlights in Kavita.",
						control: { type: "toggle", key: "includeComments" },
					},
					{
						name: "Include spoilers",
						desc: "Highlights marked as spoilers appear collapsed.",
						control: { type: "toggle", key: "includeSpoilers" },
					},
					{
						name: "Match highlight colors",
						desc: "Color each highlight like it is in Kavita. Turn off for plain quotes.",
						aliases: ["callout", "color"],
						control: { type: "toggle", key: "highlightColors" },
					},
					{
						type: "page",
						name: "Highlight template",
						desc: "Customize how each highlight is written, with a live preview.",
						displayValue: () =>
							host.settings.annotationTemplate === DEFAULT_ANNOTATION_TEMPLATE
								? "Default"
								: Result.isSuccess(
											validateTemplate(host.settings.annotationTemplate),
									  )
									? "Custom"
									: "Invalid",
						page: () => new TemplatePage(host),
					},
				],
			},
			{
				type: "group",
				heading: "Links and tags",
				items: [
					{
						name: "Link authors and series",
						desc: "Write authors and series as [[links]] so they connect to your other notes.",
						aliases: ["wikilinks"],
						control: { type: "toggle", key: "includeWikilinks" },
					},
					{
						name: "Add tags",
						desc: "Tag notes with their series, authors, and genres.",
						control: { type: "toggle", key: "includeTags" },
					},
					{
						name: "Genre tag prefix",
						desc: "Prefix for genre tags. Leave empty for genre/fantasy style tags.",
						visible: () => host.settings.includeTags,
						control: { type: "text", key: "tagPrefix", placeholder: "genre/" },
					},
				],
			},
			{
				type: "group",
				heading: "Sync",
				items: [
					{
						name: "Sync when Obsidian starts",
						desc: "Quietly fetch new highlights each time this vault opens.",
						control: { type: "toggle", key: "syncOnStartup" },
					},
					{
						name: "Sync automatically",
						desc: "Fetch new highlights in the background while Obsidian is open.",
						aliases: ["interval", "schedule"],
						control: {
							type: "dropdown",
							key: "syncInterval",
							options: {
								"0": "Off",
								"15": "Every 15 minutes",
								"30": "Every 30 minutes",
								"60": "Every hour",
								"180": "Every 3 hours",
							},
						},
					},
				],
			},
		];
	}

	private statusTitle(): string {
		if (!this.host.isConfigured()) return "Not connected";
		if (this.connection?.ok === true) return "Connected";
		if (this.connection?.ok === false) return "Can't connect";
		return this.host.settings.lastSyncedAt === ""
			? "Ready to sync"
			: `Synced ${timeAgo(this.host.settings.lastSyncedAt, Date.now())}`;
	}

	private statusDescription(): string {
		if (!this.host.isConfigured()) {
			return "Connect to your Kavita server to start syncing highlights.";
		}
		if (this.connection?.ok === true) return this.connection.text;
		if (this.connection?.ok === false) return this.connection.error.message;
		return this.host.settings.lastSyncSummary === ""
			? "Test the connection or sync your highlights."
			: this.host.settings.lastSyncSummary;
	}

	private async testConnection(): Promise<void> {
		this.checking = true;
		this.update();
		this.connection = await this.host.checkConnection(
			this.host.withAuthKey(this.host.settings),
		);
		this.checking = false;
		this.update();
	}
}
