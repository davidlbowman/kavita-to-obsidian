/**
 * Merge synced content into a note without touching what the user wrote.
 *
 * The plugin owns a set of frontmatter keys and one marked section of the
 * body. Everything else in the note is kept exactly as it is.
 *
 * @module
 */
import { Predicate } from "effect";
import { parseYaml, stringifyYaml } from "obsidian";

/**
 * Opens the plugin-managed section of a note.
 *
 * @since 2.0.0
 * @category Note
 */
export const SECTION_START =
	"%% kavita-sync:start · synced from Kavita, edits inside this section are replaced on the next sync %%";

/**
 * Closes the plugin-managed section of a note.
 *
 * @since 2.0.0
 * @category Note
 */
export const SECTION_END = "%% kavita-sync:end %%";

const START_PATTERN = /^%% kavita-sync:start\b.*%%$/m;
const END_PATTERN = /^%% kavita-sync:end %%$/m;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * What the plugin writes into a note.
 *
 * @since 2.0.0
 * @category Note
 */
export interface NoteContent {
	readonly properties: Readonly<Record<string, unknown>>;
	readonly ownedKeys: ReadonlyArray<string>;
	readonly isOwnedTag: (tag: string) => boolean;
	readonly section: string;
}

/**
 * Split a note into its parsed frontmatter and body.
 *
 * Frontmatter that is missing or not valid YAML reads as empty.
 *
 * @since 2.0.0
 * @category Note
 */
export const splitNote = (
	note: string,
): { readonly frontmatter: Record<string, unknown>; readonly body: string } => {
	const match = FRONTMATTER_PATTERN.exec(note);
	if (match === null) {
		return { frontmatter: {}, body: note };
	}
	const body = note.slice(match[0].length);
	try {
		const parsed: unknown = parseYaml(match[1] ?? "");
		return {
			frontmatter: Predicate.isObject(parsed) ? { ...parsed } : {},
			body,
		};
	} catch {
		return { frontmatter: {}, body };
	}
};

const asStrings = (value: unknown): Array<string> =>
	Array.isArray(value)
		? value.filter(Predicate.isString)
		: Predicate.isString(value)
			? [value]
			: [];

const mergeFrontmatter = (
	existing: Record<string, unknown>,
	content: NoteContent,
): Record<string, unknown> => {
	const merged: Record<string, unknown> = { ...content.properties };
	const userTags = asStrings(existing.tags).filter(
		(tag) => !content.isOwnedTag(tag),
	);
	const tags = [...new Set([...asStrings(merged.tags), ...userTags])];
	if (tags.length > 0) {
		merged.tags = tags;
	} else {
		delete merged.tags;
	}
	for (const [key, value] of Object.entries(existing)) {
		if (key !== "tags" && !content.ownedKeys.includes(key)) {
			merged[key] = value;
		}
	}
	return merged;
};

const wrapSection = (section: string): string =>
	`${SECTION_START}\n\n${section.trim()}\n\n${SECTION_END}`;

const mergeBody = (body: string, section: string): string => {
	const start = START_PATTERN.exec(body);
	const end = END_PATTERN.exec(body);
	if (start === null || end === null || end.index < start.index) {
		return `${wrapSection(section)}\n`;
	}
	const before = body.slice(0, start.index);
	const after = body.slice(end.index + end[0].length);
	return `${before}${wrapSection(section)}${after.length === 0 ? "\n" : after}`;
};

/**
 * Produce the note's new text.
 *
 * For a new note this is the plugin's frontmatter and section. For an
 * existing note, plugin-owned keys and the marked section are replaced and
 * everything else is kept. A note without markers predates them and was
 * fully plugin-generated, so its whole body becomes the section.
 *
 * @since 2.0.0
 * @category Note
 */
export const mergeNote = (
	existing: string | undefined,
	content: NoteContent,
): string => {
	const { frontmatter, body } =
		existing === undefined
			? { frontmatter: {}, body: "" }
			: splitNote(existing);
	const yaml = stringifyYaml(mergeFrontmatter(frontmatter, content));
	return `---\n${yaml.endsWith("\n") ? yaml : `${yaml}\n`}---\n\n${mergeBody(body.replace(/^\n+/, ""), content.section)}`;
};

/**
 * Ids of the highlights an existing note already shows.
 *
 * @since 2.0.0
 * @category Note
 */
export const syncedHighlightIds = (note: string): ReadonlySet<number> =>
	new Set(
		[...note.matchAll(/^\^kavita-(\d+)$/gm)].map((m) => Number(m[1] ?? 0)),
	);
