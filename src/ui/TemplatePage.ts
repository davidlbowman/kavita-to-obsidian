/**
 * Settings sub-page for editing the highlight template with a live preview.
 *
 * @module
 */
import { Result } from "effect";
import {
	type App,
	Component,
	MarkdownRenderer,
	Setting,
	SettingPage,
	type TextAreaComponent,
} from "obsidian";
import { renderChapters, TEMPLATE_VARIABLES } from "../formatters/highlight.js";
import { validateTemplate } from "../formatters/template.js";
import {
	type Annotation,
	DEFAULT_ANNOTATION_TEMPLATE,
	type PluginSettings,
} from "../schemas.js";

/**
 * What the template page needs from the plugin.
 *
 * @since 2.0.0
 * @category Template Page
 */
export interface TemplateHost {
	readonly app: App;
	readonly settings: PluginSettings;
	updateSettings(patch: Partial<PluginSettings>): Promise<void>;
	previewHighlights(): Promise<ReadonlyArray<Annotation>>;
}

const sample = (
	id: number,
	slot: number,
	page: number,
	chapterTitle: string,
	selectedText: string,
	comment: string | null,
): Annotation => ({
	id,
	selectedText,
	comment,
	commentHtml: null,
	commentPlainText: comment,
	chapterTitle,
	containsSpoiler: false,
	pageNumber: page,
	selectedSlotIndex: slot,
	seriesName: "The Great Gatsby",
	libraryName: "Books",
	chapterId: 1,
	volumeId: 1,
	seriesId: 1,
	libraryId: 1,
	ownerUserId: 1,
	createdUtc: "2026-10-12T09:30:00",
	lastModifiedUtc: "2026-10-12T09:30:00",
});

/**
 * Highlights shown in the preview until real ones load.
 *
 * @since 2.0.0
 * @category Template Page
 */
export const SAMPLE_HIGHLIGHTS: ReadonlyArray<Annotation> = [
	sample(
		1,
		2,
		3,
		"Chapter 1",
		"In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.",
		"The narrator sets up his own reliability here.",
	),
	sample(
		2,
		0,
		180,
		"Chapter 9",
		"So we beat on, boats against the current, borne back ceaselessly into the past.",
		null,
	),
];

/**
 * The template editor.
 *
 * @since 2.0.0
 * @category Template Page
 */
export class TemplatePage extends SettingPage {
	private readonly component = new Component();
	private highlights: ReadonlyArray<Annotation> = SAMPLE_HIGHLIGHTS;
	private previewEl: HTMLElement | undefined;
	private sourceEl: HTMLElement | undefined;

	constructor(private readonly host: TemplateHost) {
		super();
		this.title = "Highlight template";
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.component.load();
		containerEl.addClass("kavita-sync-template-page");

		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Controls how each highlight looks in your notes. Changes apply on the next sync.",
		});

		let editor: TextAreaComponent | undefined;
		const field = new Setting(containerEl)
			.setClass("kavita-sync-template-field")
			.addTextArea((text) => {
				editor = text;
				text
					.setValue(this.host.settings.annotationTemplate)
					.onChange((value) => void this.save(field, value));
				text.inputEl.rows = 8;
				text.inputEl.spellcheck = false;
			});

		const chips = containerEl.createDiv({ cls: "kavita-sync-template-chips" });
		for (const [name, description] of TEMPLATE_VARIABLES) {
			const chip = chips.createEl("button", {
				cls: "kavita-sync-template-chip",
				text: `{{${name}}}`,
				attr: { "aria-label": description },
			});
			chip.addEventListener("click", () => {
				if (editor === undefined) return;
				const input = editor.inputEl;
				const token = `{{${name}}}`;
				input.setRangeText(
					token,
					input.selectionStart,
					input.selectionEnd,
					"end",
				);
				input.focus();
				void this.save(field, input.value);
			});
		}

		new Setting(containerEl).addButton((button) =>
			button.setButtonText("Reset to default").onClick(async () => {
				editor?.setValue(DEFAULT_ANNOTATION_TEMPLATE);
				await this.save(field, DEFAULT_ANNOTATION_TEMPLATE);
			}),
		);

		new Setting(containerEl).setName("Preview").setHeading();
		this.sourceEl = containerEl.createDiv({
			cls: "kavita-sync-template-source setting-item-description",
			text: "Sample highlights",
		});
		this.previewEl = containerEl.createDiv({
			cls: "kavita-sync-template-preview markdown-rendered",
		});
		void this.renderPreview();
		void this.loadRealHighlights();
	}

	override hide(): void {
		this.component.unload();
	}

	private async save(field: Setting, value: string): Promise<void> {
		const validation = validateTemplate(value);
		if (Result.isFailure(validation)) {
			field.setErrorMessage(validation.failure);
			return;
		}
		field.setErrorMessage(null);
		await this.host.updateSettings({ annotationTemplate: value });
		await this.renderPreview();
	}

	private async loadRealHighlights(): Promise<void> {
		const real = await this.host.previewHighlights();
		if (real.length === 0) return;
		this.highlights = real;
		this.sourceEl?.setText("Your most recent highlights");
		await this.renderPreview();
	}

	private async renderPreview(): Promise<void> {
		const el = this.previewEl;
		if (el === undefined) return;
		const settings = this.host.settings;
		const base = URL.canParse(settings.kavitaUrl)
			? new URL(settings.kavitaUrl)
			: new URL("https://kavita.example.com");
		const markdown = renderChapters(this.highlights, settings, base, 4);
		el.empty();
		await MarkdownRenderer.render(
			this.host.app,
			markdown,
			el,
			"",
			this.component,
		);
	}
}
