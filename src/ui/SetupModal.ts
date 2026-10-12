/**
 * First-run setup: connect to Kavita, choose where highlights go, sync.
 *
 * @module
 */
import { type App, Modal, SecretComponent, Setting } from "obsidian";
import type { PluginSettings } from "../schemas.js";
import { TROUBLESHOOTING_URL } from "./errorNotice.js";
import type { ConnectionResult } from "./SyncController.js";

/**
 * What setup needs from the plugin.
 *
 * @since 2.0.0
 * @category Setup
 */
export interface SetupHost {
	readonly app: App;
	readonly settings: PluginSettings;
	withAuthKey(settings: PluginSettings): PluginSettings;
	checkConnection(settings: PluginSettings): Promise<ConnectionResult>;
	updateSettings(patch: Partial<PluginSettings>): Promise<void>;
	syncNow(): void;
}

/**
 * The setup window.
 *
 * @since 2.0.0
 * @category Setup
 */
export class SetupModal extends Modal {
	private draft: PluginSettings;
	private connection: ConnectionResult | undefined;
	private checking = false;
	private finished = false;

	constructor(
		app: App,
		private readonly host: SetupHost,
	) {
		super(app);
		this.draft = host.settings;
	}

	override onOpen(): void {
		this.setTitle("Connect to Kavita");
		this.modalEl.addClass("kavita-sync-setup");
		this.render();
	}

	override onClose(): void {
		this.contentEl.empty();
		if (!this.finished) {
			void this.host.updateSettings({
				kavitaUrl: this.draft.kavitaUrl,
				authKeySecret: this.draft.authKeySecret,
				setupDismissed: true,
			});
		}
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("p", {
			cls: "kavita-sync-setup-intro",
			text: "Bring your Kavita highlights and notes into this vault. Each book gets its own note with your highlights, grouped by chapter, linked back to the exact spot in Kavita.",
		});

		new Setting(contentEl)
			.setName("Server URL")
			.setDesc("The address you open Kavita at, including the port.")
			.addText((text) =>
				text
					.setPlaceholder("https://kavita.example.com")
					.setValue(this.draft.kavitaUrl)
					.onChange((value) => {
						this.draft = { ...this.draft, kavitaUrl: value.trim() };
						this.connection = undefined;
					}),
			);

		new Setting(contentEl)
			.setName("Auth key")
			.setDesc(
				createFragment((f) => {
					f.appendText(
						"In Kavita, open your user settings → manage auth keys and create one. Older servers call it the API key. ",
					);
					f.createEl("a", {
						text: "Where to find it",
						href: `${TROUBLESHOOTING_URL}#how-to-find-your-kavita-api-key`,
					});
				}),
			)
			.addComponent((el) =>
				new SecretComponent(this.app, el)
					.setValue(this.draft.authKeySecret)
					.onChange((value) => {
						this.draft = { ...this.draft, authKeySecret: value ?? "" };
						this.connection = undefined;
					}),
			);

		const connect = new Setting(contentEl).addButton((button) =>
			button
				.setButtonText(this.checking ? "Connecting…" : "Connect")
				.setCta()
				.setDisabled(this.checking)
				.onClick(() => void this.connect()),
		);
		const status = connect.descEl.createDiv({ cls: "kavita-sync-connection" });
		if (this.connection?.ok === true) {
			status.addClass("is-connected");
			status.setText(this.connection.text);
		} else if (this.connection?.ok === false) {
			status.addClass("is-failed");
			status.setText(this.connection.error.message);
		}

		if (this.connection?.ok !== true) {
			new Setting(contentEl).addButton((button) =>
				button.setButtonText("Not now").onClick(() => this.close()),
			);
			return;
		}

		new Setting(contentEl).setName("Where highlights go").setHeading();

		new Setting(contentEl)
			.setName("Layout")
			.setDesc("A note per book works best with links, graph view, and Bases.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("hierarchical", "One note per book")
					.addOption("single-file", "One note for everything")
					.setValue(this.draft.exportMode)
					.onChange((value) => {
						this.draft = {
							...this.draft,
							exportMode:
								value === "single-file" ? "single-file" : "hierarchical",
						};
						this.render();
					}),
			);

		if (this.draft.exportMode === "hierarchical") {
			new Setting(contentEl)
				.setName("Folder")
				.setDesc("Book notes are filed by series inside this folder.")
				.addText((text) =>
					text.setValue(this.draft.rootFolderName).onChange((value) => {
						this.draft = { ...this.draft, rootFolderName: value.trim() };
					}),
				);
			new Setting(contentEl)
				.setName("Download book covers")
				.setDesc("Shows each cover at the top of its note.")
				.addToggle((toggle) =>
					toggle.setValue(this.draft.downloadCovers).onChange((value) => {
						this.draft = { ...this.draft, downloadCovers: value };
					}),
				);
			new Setting(contentEl)
				.setName("Create a library view")
				.setDesc("Adds a base that shows your books as cover cards.")
				.addToggle((toggle) =>
					toggle.setValue(this.draft.createLibraryView).onChange((value) => {
						this.draft = { ...this.draft, createLibraryView: value };
					}),
				);
		} else {
			new Setting(contentEl)
				.setName("Note")
				.setDesc("Path of the note that collects every highlight.")
				.addText((text) =>
					text.setValue(this.draft.outputPath).onChange((value) => {
						this.draft = { ...this.draft, outputPath: value.trim() };
					}),
				);
		}

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText("Not now").onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText("Sync now")
					.setCta()
					.onClick(() => void this.finish()),
			);
	}

	private async connect(): Promise<void> {
		this.checking = true;
		this.connection = undefined;
		this.render();
		this.connection = await this.host.checkConnection(
			this.host.withAuthKey(this.draft),
		);
		this.checking = false;
		this.render();
	}

	private async finish(): Promise<void> {
		this.finished = true;
		await this.host.updateSettings({
			kavitaUrl: this.draft.kavitaUrl,
			authKeySecret: this.draft.authKeySecret,
			exportMode: this.draft.exportMode,
			rootFolderName: this.draft.rootFolderName,
			outputPath: this.draft.outputPath,
			downloadCovers: this.draft.downloadCovers,
			createLibraryView: this.draft.createLibraryView,
			setupDismissed: true,
		});
		this.close();
		this.host.syncNow();
	}
}
