/**
 * Schema definitions for Kavita API responses and plugin settings.
 *
 * @module
 */
import { Schema, SchemaGetter, SchemaTransformation } from "effect";

/**
 * Helper to create an optional key with a default value.
 *
 * Replaces `Schema.optionalWith(schema, { exact: true, default: () => val })` in v4.
 *
 * @since 2.0.0
 * @category Helpers
 */
const optionalKeyWithDefault = <S extends Schema.Top>(
	schema: S,
	defaultValue: () => S["Type"],
) =>
	Schema.optionalKey(schema).pipe(
		Schema.decodeTo(Schema.toType(schema), {
			decode: SchemaGetter.withDefault(defaultValue),
			encode: SchemaGetter.required(),
		}),
	);

/**
 * Kavita annotation data transfer object.
 *
 * Represents an annotation/highlight on a book in Kavita.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class AnnotationDto extends Schema.Class<AnnotationDto>("AnnotationDto")(
	{
		id: Schema.Number,
		/** Starting XPath selector for the highlight */
		xPath: Schema.NullOr(Schema.String),
		/** Ending XPath selector (can be same as xPath for single element) */
		endingXPath: Schema.NullOr(Schema.String),
		/** The highlighted text */
		selectedText: Schema.NullOr(Schema.String),
		/** User's comment on the annotation (rich text) */
		comment: Schema.NullOr(Schema.String),
		/** HTML version of comment */
		commentHtml: Schema.NullOr(Schema.String),
		/** Plain text version of comment */
		commentPlainText: Schema.NullOr(Schema.String),
		/** Title of the TOC chapter within EPUB */
		chapterTitle: Schema.NullOr(Schema.String),
		/** Surrounding text context */
		context: Schema.NullOr(Schema.String),
		/** Number of characters selected */
		highlightCount: Schema.Number,
		/** Whether this annotation contains spoilers */
		containsSpoiler: Schema.Boolean,
		/** Page number in the book */
		pageNumber: Schema.Number,
		/** Highlight color slot index (0-4) */
		selectedSlotIndex: Schema.Number,
		/** User IDs who liked this annotation */
		likes: Schema.NullOr(Schema.Array(Schema.Number)),
		/** Name of the series */
		seriesName: Schema.NullOr(Schema.String),
		/** Name of the library */
		libraryName: Schema.NullOr(Schema.String),
		/** Chapter ID */
		chapterId: Schema.Number,
		/** Volume ID */
		volumeId: Schema.Number,
		/** Series ID */
		seriesId: Schema.Number,
		/** Library ID */
		libraryId: Schema.Number,
		/** Owner user ID */
		ownerUserId: Schema.Number,
		/** Owner username */
		ownerUsername: Schema.NullOr(Schema.String),
		/** Age rating of the series */
		ageRating: Schema.Number,
		/** Creation timestamp */
		createdUtc: Schema.String,
		/** Last modified timestamp */
		lastModifiedUtc: Schema.String,
	},
) {}

/**
 * Filter parameters for browsing annotations.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class BrowseAnnotationFilterDto extends Schema.Class<BrowseAnnotationFilterDto>(
	"BrowseAnnotationFilterDto",
)({
	seriesIds: Schema.optionalKey(Schema.Array(Schema.Number)),
	chapterIds: Schema.optionalKey(Schema.Array(Schema.Number)),
	includeSpoilers: Schema.optionalKey(Schema.Boolean),
	startDate: Schema.optionalKey(Schema.DateTimeUtc),
	endDate: Schema.optionalKey(Schema.DateTimeUtc),
}) {}

/**
 * Array of annotations response from Kavita API.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export const AnnotationsResponse = Schema.Array(AnnotationDto);

/**
 * Type alias for annotations response.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export type AnnotationsResponseType = typeof AnnotationsResponse.Type;

/**
 * Export mode for annotations.
 *
 * @since 1.1.0
 * @category Plugin Schemas
 */
export const ExportMode = Schema.Literals(["single-file", "hierarchical"]);

/**
 * Default Handlebars template for rendering individual annotations.
 *
 * @since 1.2.0
 * @category Plugin Schemas
 */
export const DEFAULT_ANNOTATION_TEMPLATE = `{{blockquote}}
{{#if comment}}

*Note:* {{comment}}
{{/if}}
{{#if pageNumber}}

<small>Page {{pageNumber}}</small>
{{/if}}`;

/**
 * Plugin settings stored in Obsidian.
 *
 * @since 0.0.1
 * @category Plugin Schemas
 */
export class PluginSettings extends Schema.Class<PluginSettings>(
	"PluginSettings",
)({
	kavitaUrl: Schema.String,
	kavitaApiKey: Schema.String,
	outputPath: optionalKeyWithDefault(
		Schema.String,
		() => "kavita-annotations.md",
	),
	matchThreshold: optionalKeyWithDefault(
		Schema.Number.pipe(
			Schema.decodeTo(
				Schema.Number,
				SchemaTransformation.transform({
					decode: (n) => Math.min(1, Math.max(0, n)),
					encode: (n) => n,
				}),
			),
		),
		() => 0.7,
	),
	includeComments: optionalKeyWithDefault(Schema.Boolean, () => true),
	includeSpoilers: optionalKeyWithDefault(Schema.Boolean, () => false),
	/**
	 * Include Obsidian tags generated from series, author, and library names.
	 * @since 0.0.2
	 */
	includeTags: optionalKeyWithDefault(Schema.Boolean, () => true),
	/**
	 * Prefix for generated tags (e.g., "reading/" produces #reading/book/...).
	 * @since 0.0.2
	 */
	tagPrefix: optionalKeyWithDefault(Schema.String, () => ""),
	/**
	 * Include wikilinks for series and author names (e.g., [[Author Name]]).
	 * @since 0.0.2
	 */
	includeWikilinks: optionalKeyWithDefault(Schema.Boolean, () => true),
	/**
	 * Export mode: single file or hierarchical folders.
	 * @since 1.1.0
	 */
	exportMode: optionalKeyWithDefault(ExportMode, () => "hierarchical" as const),
	/**
	 * Root folder name for hierarchical mode.
	 * @since 1.1.0
	 */
	rootFolderName: optionalKeyWithDefault(
		Schema.String,
		() => "Kavita Annotations",
	),
	/**
	 * Delete orphaned files when annotations are removed from Kavita.
	 * @since 1.1.0
	 */
	deleteOrphanedFiles: optionalKeyWithDefault(Schema.Boolean, () => true),
	/**
	 * Handlebars template for rendering individual annotations.
	 * @since 1.2.0
	 */
	annotationTemplate: optionalKeyWithDefault(
		Schema.String,
		() => DEFAULT_ANNOTATION_TEMPLATE,
	),
}) {}

/**
 * Default plugin settings.
 *
 * @since 0.0.1
 * @category Plugin Schemas
 */
export const DEFAULT_SETTINGS: typeof PluginSettings.Type = {
	kavitaUrl: "",
	kavitaApiKey: "",
	outputPath: "kavita-annotations.md",
	matchThreshold: 0.7,
	includeComments: true,
	includeSpoilers: false,
	includeTags: true,
	tagPrefix: "",
	includeWikilinks: true,
	exportMode: "hierarchical",
	rootFolderName: "Kavita Annotations",
	deleteOrphanedFiles: true,
	annotationTemplate: DEFAULT_ANNOTATION_TEMPLATE,
};

/**
 * Kavita library types.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export const LibraryType = {
	Manga: 0,
	Comic: 1,
	Book: 2,
	Images: 3,
	LightNovel: 4,
} as const;

/**
 * Kavita library data transfer object.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class LibraryDto extends Schema.Class<LibraryDto>("LibraryDto")({
	id: Schema.Number,
	name: Schema.String,
	type: Schema.Number,
	folders: Schema.optionalKey(Schema.Array(Schema.String)),
}) {}

/**
 * Request to create a library.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class CreateLibraryDto extends Schema.Class<CreateLibraryDto>(
	"CreateLibraryDto",
)({
	name: Schema.String,
	type: Schema.Number,
	folders: Schema.Array(Schema.String),
	fileGroupTypes: optionalKeyWithDefault(Schema.Array(Schema.Number), () => []),
	excludePatterns: optionalKeyWithDefault(
		Schema.Array(Schema.String),
		() => [],
	),
	/**
	 * Enable reading metadata from files (authors, genres, etc.).
	 * @since 0.0.2
	 */
	enableMetadata: optionalKeyWithDefault(Schema.Boolean, () => true),
}) {}

/**
 * Genre tag from Kavita metadata.
 *
 * @since 0.0.2
 * @category Kavita Schemas
 */
export class GenreTagDto extends Schema.Class<GenreTagDto>("GenreTagDto")({
	id: Schema.Number,
	title: Schema.String,
}) {}

/**
 * Tag from Kavita metadata.
 *
 * @since 0.0.2
 * @category Kavita Schemas
 */
export class TagDto extends Schema.Class<TagDto>("TagDto")({
	id: Schema.Number,
	title: Schema.String,
}) {}

/**
 * Person (author, artist, etc.) from Kavita metadata.
 *
 * @since 0.0.2
 * @category Kavita Schemas
 */
export class PersonDto extends Schema.Class<PersonDto>("PersonDto")({
	id: Schema.Number,
	name: Schema.String,
	description: Schema.NullOr(Schema.String),
}) {}

/**
 * Kavita chapter data transfer object.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class ChapterDto extends Schema.Class<ChapterDto>("ChapterDto")({
	id: Schema.Number,
	number: Schema.String,
	title: Schema.optionalKey(Schema.String),
	pages: Schema.optionalKey(Schema.Number),
	/**
	 * The book title from EPUB dc:title metadata.
	 * @since 0.0.2
	 */
	titleName: Schema.optionalKey(Schema.String),
	/**
	 * Sort order for the chapter within the series.
	 * @since 0.0.2
	 */
	sortOrder: Schema.optionalKey(Schema.Number),
	/**
	 * Writers/authors for this specific chapter/book.
	 * @since 0.0.2
	 */
	writers: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	/**
	 * Genres for this specific chapter/book.
	 * @since 0.0.2
	 */
	genres: optionalKeyWithDefault(Schema.Array(GenreTagDto), () => []),
}) {}

/**
 * Kavita volume data transfer object.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class VolumeDto extends Schema.Class<VolumeDto>("VolumeDto")({
	id: Schema.Number,
	number: Schema.Number,
	name: Schema.optionalKey(Schema.String),
	chapters: Schema.Array(ChapterDto),
}) {}

/**
 * Kavita series data transfer object.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class SeriesDto extends Schema.Class<SeriesDto>("SeriesDto")({
	id: Schema.Number,
	name: Schema.String,
	libraryId: Schema.optionalKey(Schema.Number),
}) {}

/**
 * Paginated series response.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class SeriesPagedResponse extends Schema.Class<SeriesPagedResponse>(
	"SeriesPagedResponse",
)({
	result: Schema.Array(SeriesDto),
	pagination: Schema.optionalKey(
		Schema.Struct({
			currentPage: Schema.Number,
			totalPages: Schema.Number,
			totalItems: Schema.Number,
		}),
	),
}) {}

/**
 * Request to create an annotation.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class CreateAnnotationDto extends Schema.Class<CreateAnnotationDto>(
	"CreateAnnotationDto",
)({
	/** Chapter ID (required) */
	chapterId: Schema.Number,
	/** Volume ID (required) */
	volumeId: Schema.Number,
	/** Series ID (required) */
	seriesId: Schema.Number,
	/** Library ID (required) */
	libraryId: Schema.Number,
	/** Owner user ID (required) */
	ownerUserId: Schema.Number,
	/** Starting XPath selector for the highlight (required) */
	xPath: Schema.String,
	/** The highlighted text (required) */
	selectedText: Schema.String,
	/** Number of characters selected (required) */
	highlightCount: Schema.Number,
	/** Page number in the book (required) */
	pageNumber: Schema.Number,
	/** Highlight color slot index 0-4 (required) */
	selectedSlotIndex: Schema.Number,
	/** Whether this annotation contains spoilers (required) */
	containsSpoiler: Schema.Boolean,
	/** Ending XPath selector (optional, defaults to xPath) */
	endingXPath: Schema.optionalKey(Schema.String),
	/** User's comment on the annotation (optional) */
	comment: Schema.optionalKey(Schema.String),
}) {}

/**
 * Request to register a new user.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class RegisterDto extends Schema.Class<RegisterDto>("RegisterDto")({
	username: Schema.String,
	email: Schema.String,
	password: Schema.String,
}) {}

/**
 * Request to login.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class LoginDto extends Schema.Class<LoginDto>("LoginDto")({
	username: Schema.String,
	password: Schema.String,
}) {}

/**
 * Response from login.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class UserDto extends Schema.Class<UserDto>("UserDto")({
	token: Schema.String,
	apiKey: Schema.optionalKey(Schema.String),
	username: Schema.String,
}) {}

/**
 * Series metadata from Kavita API.
 *
 * Contains detailed metadata including writers, genres, tags, etc.
 *
 * @since 0.0.2
 * @category Kavita Schemas
 */
export class SeriesMetadataDto extends Schema.Class<SeriesMetadataDto>(
	"SeriesMetadataDto",
)({
	id: Schema.Number,
	seriesId: Schema.Number,
	summary: Schema.NullOr(Schema.String),
	releaseYear: Schema.Number,
	language: Schema.NullOr(Schema.String),
	genres: optionalKeyWithDefault(Schema.Array(GenreTagDto), () => []),
	tags: optionalKeyWithDefault(Schema.Array(TagDto), () => []),
	writers: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	coverArtists: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	publishers: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	characters: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	pencillers: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	inkers: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	colorists: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	letterers: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	editors: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
	translators: optionalKeyWithDefault(Schema.Array(PersonDto), () => []),
}) {}
