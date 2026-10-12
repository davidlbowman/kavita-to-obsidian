/**
 * Schemas for Kavita API payloads, plugin settings, and sync results.
 *
 * Every type the plugin uses is derived from a schema in this module.
 *
 * @module
 */
import { Effect, Predicate, Schema, SchemaGetter } from "effect";

/**
 * A JSON array that Kavita may send as `null`, decoded to an empty array.
 *
 * @since 2.0.0
 * @category Helpers
 */
const NullableArray = <S extends Schema.Top>(item: S) =>
	Schema.NullOr(Schema.Array(item)).pipe(
		Schema.decodeTo(Schema.Array(Schema.toType(item)), {
			decode: SchemaGetter.transform((value) => value ?? []),
			encode: SchemaGetter.transform((value) => value),
		}),
	);

/**
 * A highlight or note on a book in Kavita.
 *
 * Only the fields the plugin reads are declared; Kavita sends more.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export const Annotation = Schema.Struct({
	id: Schema.Int,
	selectedText: Schema.NullOr(Schema.String),
	comment: Schema.NullOr(Schema.String),
	commentHtml: Schema.NullOr(Schema.String),
	commentPlainText: Schema.NullOr(Schema.String),
	chapterTitle: Schema.NullOr(Schema.String),
	containsSpoiler: Schema.Boolean,
	pageNumber: Schema.Int,
	selectedSlotIndex: Schema.Int,
	seriesName: Schema.NullOr(Schema.String),
	libraryName: Schema.NullOr(Schema.String),
	chapterId: Schema.Int,
	volumeId: Schema.Int,
	seriesId: Schema.Int,
	libraryId: Schema.Int,
	ownerUserId: Schema.Int,
	createdUtc: Schema.String,
	lastModifiedUtc: Schema.String,
});

/**
 * @since 0.0.1
 * @category Kavita Schemas
 */
export type Annotation = typeof Annotation.Type;

/**
 * Response body of `POST /api/Annotation/all-filtered`.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export const Annotations = Schema.Array(Annotation);

/**
 * A person credited on a chapter (writer, artist, ...).
 *
 * @since 0.0.2
 * @category Kavita Schemas
 */
export const Person = Schema.Struct({
	name: Schema.NullOr(Schema.String),
});

/**
 * A genre on a chapter.
 *
 * @since 0.0.2
 * @category Kavita Schemas
 */
export const Genre = Schema.Struct({
	title: Schema.NullOr(Schema.String),
});

/**
 * A chapter (for books, the book itself) within a volume.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export const Chapter = Schema.Struct({
	id: Schema.Int,
	titleName: Schema.optionalKey(Schema.NullOr(Schema.String)),
	writers: Schema.optionalKey(NullableArray(Person)),
	genres: Schema.optionalKey(NullableArray(Genre)),
});

/**
 * @since 0.0.1
 * @category Kavita Schemas
 */
export type Chapter = typeof Chapter.Type;

/**
 * A volume and its chapters.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export const Volume = Schema.Struct({
	id: Schema.Int,
	number: Schema.Finite,
	name: Schema.optionalKey(Schema.NullOr(Schema.String)),
	chapters: NullableArray(Chapter),
});

/**
 * @since 0.0.1
 * @category Kavita Schemas
 */
export type Volume = typeof Volume.Type;

/**
 * Response body of `GET /api/Series/volumes`.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export const Volumes = Schema.Array(Volume);

/**
 * The session token from `POST /api/Plugin/authenticate`.
 *
 * Kavita leaves the user `id` in this response as `0`, so the id is read
 * from {@link CurrentUser} instead.
 *
 * @since 2.0.0
 * @category Kavita Schemas
 */
export const PluginSession = Schema.Struct({
	token: Schema.String,
});

/**
 * The fields the plugin reads from `GET /api/Account`.
 *
 * @since 2.0.0
 * @category Kavita Schemas
 */
export const CurrentUser = Schema.Struct({
	id: Schema.Int,
	username: Schema.optionalKey(Schema.NullOr(Schema.String)),
	kavitaVersion: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

/**
 * @since 2.0.0
 * @category Kavita Schemas
 */
export type CurrentUser = typeof CurrentUser.Type;

/**
 * Book-level metadata for one chapter, resolved from its volume.
 *
 * @since 0.0.2
 * @category Sync Schemas
 */
export const ChapterInfo = Schema.Struct({
	chapterId: Schema.Int,
	bookTitle: Schema.String,
	sortOrder: Schema.Finite,
	authors: Schema.Array(Schema.String),
	genres: Schema.Array(Schema.String),
});

/**
 * @since 0.0.2
 * @category Sync Schemas
 */
export type ChapterInfo = typeof ChapterInfo.Type;

/**
 * One book's highlights plus the metadata for its note.
 *
 * @since 1.1.0
 * @category Sync Schemas
 */
export const Book = Schema.Struct({
	bookTitle: Schema.String,
	seriesName: Schema.String,
	seriesIndex: Schema.Finite,
	seriesId: Schema.Int,
	chapterId: Schema.Int,
	libraryId: Schema.Int,
	authors: Schema.Array(Schema.String),
	genres: Schema.Array(Schema.String),
	annotations: Schema.Array(Annotation),
});

/**
 * @since 1.1.0
 * @category Sync Schemas
 */
export type Book = typeof Book.Type;

/**
 * Kavita's five highlight colors, in highlight-slot order.
 *
 * @since 2.0.0
 * @category Sync Schemas
 */
export const HighlightColor = Schema.Literals([
	"cyan",
	"green",
	"yellow",
	"orange",
	"magenta",
]);

/**
 * @since 2.0.0
 * @category Sync Schemas
 */
export type HighlightColor = typeof HighlightColor.Type;

/**
 * What a sync did, for the summary notice and the settings status row.
 *
 * @since 2.0.0
 * @category Sync Schemas
 */
export const SyncSummary = Schema.Struct({
	highlights: Schema.Int,
	newHighlights: Schema.Int,
	books: Schema.Int,
	notesCreated: Schema.Int,
	notesUpdated: Schema.Int,
	notesUnchanged: Schema.Int,
	notesDeleted: Schema.Int,
	openPath: Schema.String,
});

/**
 * @since 2.0.0
 * @category Sync Schemas
 */
export type SyncSummary = typeof SyncSummary.Type;

/**
 * Who and what a working connection reaches.
 *
 * @since 2.0.0
 * @category Sync Schemas
 */
export const ConnectionInfo = Schema.Struct({
	username: Schema.String,
	kavitaVersion: Schema.String,
	highlights: Schema.Int,
	books: Schema.Int,
});

/**
 * @since 2.0.0
 * @category Sync Schemas
 */
export type ConnectionInfo = typeof ConnectionInfo.Type;

/**
 * How annotations are laid out in the vault.
 *
 * @since 1.1.0
 * @category Plugin Schemas
 */
export const ExportMode = Schema.Literals(["single-file", "hierarchical"]);

/**
 * @since 1.1.0
 * @category Plugin Schemas
 */
export type ExportMode = typeof ExportMode.Type;

/**
 * The default template before 2.0; settings still holding it are upgraded.
 *
 * @since 2.0.0
 * @category Plugin Schemas
 */
export const LEGACY_ANNOTATION_TEMPLATE = `{{blockquote}}
{{#if comment}}

*Note:* {{comment}}
{{/if}}
{{#if pageNumber}}

<small>Page {{pageNumber}}</small>
{{/if}}`;

/**
 * Default template for rendering one highlight: a callout colored like the
 * Kavita highlight, titled with a link back to it in Kavita's reader.
 *
 * @since 1.2.0
 * @category Plugin Schemas
 */
export const DEFAULT_ANNOTATION_TEMPLATE = `> [!{{callout}}]{{fold}} [{{location}}]({{link}})
{{quote}}{{#if comment}}
>
> **Note:** {{commentQuote}}{{/if}}`;

/**
 * A stored setting that falls back to its default when missing or malformed,
 * so one bad value in `data.json` never discards the rest.
 *
 * @since 2.0.0
 * @category Helpers
 */
const setting = <S extends Schema.Codec<unknown, unknown>>(
	schema: S,
	fallback: S["Type"],
) => {
	const lenient = Schema.catchDecoding<S>(() => Effect.succeedSome(fallback))(
		schema,
	);
	return Schema.withDecodingDefaultTypeKey<typeof lenient>(
		Effect.succeed(fallback),
	)(lenient);
};

/**
 * Minutes between automatic syncs; `0` turns automatic sync off.
 *
 * @since 2.0.0
 * @category Plugin Schemas
 */
export const SyncInterval = Schema.Literals([0, 15, 30, 60, 180]);

/**
 * Plugin settings as persisted in the vault's `data.json`.
 *
 * Decoding never fails: unknown keys are dropped and missing or malformed
 * values take their defaults. The auth key itself lives in Obsidian's secret
 * storage; `authKeySecret` is only the name of that secret.
 *
 * @since 0.0.1
 * @category Plugin Schemas
 */
export const PluginSettings = Schema.Struct({
	kavitaUrl: setting(Schema.String, ""),
	authKeySecret: setting(Schema.String, ""),
	kavitaApiKey: setting(Schema.String, ""),
	exportMode: setting(ExportMode, "hierarchical"),
	outputPath: setting(Schema.String, "kavita-annotations.md"),
	rootFolderName: setting(Schema.String, "Kavita Annotations"),
	deleteOrphanedFiles: setting(Schema.Boolean, true),
	downloadCovers: setting(Schema.Boolean, true),
	createLibraryView: setting(Schema.Boolean, false),
	includeComments: setting(Schema.Boolean, true),
	includeSpoilers: setting(Schema.Boolean, false),
	highlightColors: setting(Schema.Boolean, true),
	includeTags: setting(Schema.Boolean, true),
	tagPrefix: setting(Schema.String, ""),
	includeWikilinks: setting(Schema.Boolean, true),
	annotationTemplate: setting(Schema.String, DEFAULT_ANNOTATION_TEMPLATE),
	syncOnStartup: setting(Schema.Boolean, false),
	syncInterval: setting(SyncInterval, 0),
	setupDismissed: setting(Schema.Boolean, false),
	lastSyncedAt: setting(Schema.String, ""),
	lastSyncSummary: setting(Schema.String, ""),
});

/**
 * @since 0.0.1
 * @category Plugin Schemas
 */
export type PluginSettings = typeof PluginSettings.Type;

const decodeSettingsObject = Schema.decodeUnknownSync(PluginSettings);

/**
 * Decode whatever Obsidian loaded from `data.json` into complete settings.
 *
 * Anything that is not an object (a corrupt or hand-edited file) is treated
 * as a fresh install rather than failing plugin load. A template still equal
 * to the pre-2.0 default is upgraded to the current default.
 *
 * @since 2.0.0
 * @category Plugin Schemas
 */
export const decodePluginSettings = (input: unknown): PluginSettings => {
	const settings = decodeSettingsObject(Predicate.isObject(input) ? input : {});
	return settings.annotationTemplate === LEGACY_ANNOTATION_TEMPLATE
		? { ...settings, annotationTemplate: DEFAULT_ANNOTATION_TEMPLATE }
		: settings;
};

/**
 * Settings for a fresh install.
 *
 * @since 0.0.1
 * @category Plugin Schemas
 */
export const DEFAULT_SETTINGS: PluginSettings = decodePluginSettings({});

/**
 * The note-formatting subset of the settings.
 *
 * @since 0.0.1
 * @category Plugin Schemas
 */
export const FormatOptions = PluginSettings.mapFields((fields) => ({
	includeComments: fields.includeComments,
	includeSpoilers: fields.includeSpoilers,
	highlightColors: fields.highlightColors,
	includeTags: fields.includeTags,
	tagPrefix: fields.tagPrefix,
	includeWikilinks: fields.includeWikilinks,
	annotationTemplate: fields.annotationTemplate,
}));

/**
 * @since 0.0.1
 * @category Plugin Schemas
 */
export type FormatOptions = typeof FormatOptions.Type;

/**
 * Base URL of the Kavita server; must be http(s).
 *
 * @since 2.0.0
 * @category Plugin Schemas
 */
export const KavitaUrl = Schema.URLFromString.pipe(
	Schema.check(
		Schema.makeFilter(
			(url: URL) => url.protocol === "http:" || url.protocol === "https:",
			{ message: "must be an http:// or https:// address" },
		),
	),
);
