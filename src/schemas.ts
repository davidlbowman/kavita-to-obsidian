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
	matchThreshold: Schema.optionalWith(Schema.Number, {
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
};

// ============================================================================
// Kavita Library/Series/Chapter Schemas
// ============================================================================

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

// ============================================================================
// Kavita Auth Schemas
// ============================================================================

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
