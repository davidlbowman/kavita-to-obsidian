/**
 * Schema definitions for Kavita API responses and plugin settings.
 *
 * @module
 */
import { Schema } from "effect";

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
	seriesIds: Schema.optionalWith(Schema.Array(Schema.Number), { exact: true }),
	chapterIds: Schema.optionalWith(Schema.Array(Schema.Number), {
		exact: true,
	}),
	includeSpoilers: Schema.optionalWith(Schema.Boolean, { exact: true }),
	startDate: Schema.optionalWith(Schema.DateTimeUtc, { exact: true }),
	endDate: Schema.optionalWith(Schema.DateTimeUtc, { exact: true }),
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
	outputPath: Schema.optionalWith(Schema.String, {
		exact: true,
		default: () => "kavita-annotations.md",
	}),
	matchThreshold: Schema.optionalWith(Schema.Number.pipe(Schema.clamp(0, 1)), {
		exact: true,
		default: () => 0.7,
	}),
	includeComments: Schema.optionalWith(Schema.Boolean, {
		exact: true,
		default: () => true,
	}),
	includeSpoilers: Schema.optionalWith(Schema.Boolean, {
		exact: true,
		default: () => false,
	}),
	/**
	 * Include Obsidian tags generated from series, author, and library names.
	 * @since 0.0.2
	 */
	includeTags: Schema.optionalWith(Schema.Boolean, {
		exact: true,
		default: () => true,
	}),
	/**
	 * Prefix for generated tags (e.g., "kavita/" produces #kavita/series/...).
	 * @since 0.0.2
	 */
	tagPrefix: Schema.optionalWith(Schema.String, {
		exact: true,
		default: () => "kavita/",
	}),
	/**
	 * Include wikilinks for series and author names (e.g., [[Author Name]]).
	 * @since 0.0.2
	 */
	includeWikilinks: Schema.optionalWith(Schema.Boolean, {
		exact: true,
		default: () => true,
	}),
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
	tagPrefix: "kavita/",
	includeWikilinks: true,
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
	folders: Schema.optionalWith(Schema.Array(Schema.String), { exact: true }),
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
	fileGroupTypes: Schema.optionalWith(Schema.Array(Schema.Number), {
		exact: true,
		default: () => [],
	}),
	excludePatterns: Schema.optionalWith(Schema.Array(Schema.String), {
		exact: true,
		default: () => [],
	}),
	/**
	 * Enable reading metadata from files (authors, genres, etc.).
	 * @since 0.0.2
	 */
	enableMetadata: Schema.optionalWith(Schema.Boolean, {
		exact: true,
		default: () => true,
	}),
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
	title: Schema.optionalWith(Schema.String, { exact: true }),
	pages: Schema.optionalWith(Schema.Number, { exact: true }),
	/**
	 * The book title from EPUB dc:title metadata.
	 * @since 0.0.2
	 */
	titleName: Schema.optionalWith(Schema.String, { exact: true }),
	/**
	 * Sort order for the chapter within the series.
	 * @since 0.0.2
	 */
	sortOrder: Schema.optionalWith(Schema.Number, { exact: true }),
	/**
	 * Writers/authors for this specific chapter/book.
	 * @since 0.0.2
	 */
	writers: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	/**
	 * Genres for this specific chapter/book.
	 * @since 0.0.2
	 */
	genres: Schema.optionalWith(Schema.Array(GenreTagDto), {
		exact: true,
		default: () => [],
	}),
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
	name: Schema.optionalWith(Schema.String, { exact: true }),
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
	libraryId: Schema.optionalWith(Schema.Number, { exact: true }),
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
	pagination: Schema.optionalWith(
		Schema.Struct({
			currentPage: Schema.Number,
			totalPages: Schema.Number,
			totalItems: Schema.Number,
		}),
		{ exact: true },
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
	endingXPath: Schema.optionalWith(Schema.String, { exact: true }),
	/** User's comment on the annotation (optional) */
	comment: Schema.optionalWith(Schema.String, { exact: true }),
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
	apiKey: Schema.optionalWith(Schema.String, { exact: true }),
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
	genres: Schema.optionalWith(Schema.Array(GenreTagDto), {
		exact: true,
		default: () => [],
	}),
	tags: Schema.optionalWith(Schema.Array(TagDto), {
		exact: true,
		default: () => [],
	}),
	writers: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	coverArtists: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	publishers: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	characters: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	pencillers: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	inkers: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	colorists: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	letterers: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	editors: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
	translators: Schema.optionalWith(Schema.Array(PersonDto), {
		exact: true,
		default: () => [],
	}),
}) {}
