/**
 * Merge synced content into a note without touching what the user wrote.
 *
 * The plugin owns a set of frontmatter keys and the body above the
 * "My notes" heading. The user's own properties and everything from that
 * heading down are kept exactly as they are.
 *
 * @module
 */
import { Predicate } from "effect";
import { parseYaml, stringifyYaml } from "obsidian";

/**
 * The heading that ends the synced part of a note. Everything from this
 * heading to the end of the note belongs to the user.
 *
 * @since 2.0.0
 * @category Note
 */
export const MY_NOTES_HEADING = "## My notes";

const MY_NOTES_PATTERN = /^## My notes[ \t]*$/gm;
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

const mergeBody = (body: string, section: string): string => {
	const headings = [...body.matchAll(MY_NOTES_PATTERN)];
	const last = headings.at(-1);
	const mine =
		last === undefined
			? `${MY_NOTES_HEADING}\n`
			: body.slice(last.index).replace(/\n*$/, "\n");
	return `${section.trim()}\n\n${mine}`;
};

/**
 * Produce the note's new text.
 *
 * The note is the plugin's properties merged with the user's, the synced
 * section, then the "My notes" heading and whatever the user wrote under
 * it. A note without the heading (new, or from an older version) gets an
 * empty one.
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
 * Ids of the highlights an existing note already shows, read from their
 * links back to Kavita.
 *
 * @since 2.0.0
 * @category Note
 */
export const syncedHighlightIds = (note: string): ReadonlySet<number> =>
	new Set(
		[...note.matchAll(/[?&]annotation=(\d+)\b/g)].map((m) => Number(m[1] ?? 0)),
	);
