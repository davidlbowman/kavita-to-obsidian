/**
 * Schema definitions for Kavita API responses and plugin settings.
 *
 * @module
 */
import { Schema } from "effect";

/**
 * Kavita annotation data transfer object.
 *
 * @since 0.0.1
 * @category Kavita Schemas
 */
export class AnnotationDto extends Schema.Class<AnnotationDto>("AnnotationDto")(
	{
		id: Schema.Number,
		chapterId: Schema.Number,
		seriesId: Schema.optionalWith(Schema.Number, { exact: true }),
		content: Schema.String,
		comment: Schema.optionalWith(Schema.String, { exact: true }),
		spoiler: Schema.Boolean,
		highlightSlot: Schema.Number,
		page: Schema.optionalWith(Schema.Number, { exact: true }),
		position: Schema.optionalWith(Schema.Number, { exact: true }),
		createdAt: Schema.optionalWith(Schema.DateTimeUtc, { exact: true }),
		updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { exact: true }),
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
	chapterId: Schema.Number,
	content: Schema.String,
	comment: Schema.optionalWith(Schema.String, { exact: true }),
	spoiler: Schema.optionalWith(Schema.Boolean, {
		exact: true,
		default: () => false,
	}),
	highlightSlot: Schema.optionalWith(Schema.Number, {
		exact: true,
		default: () => 0,
	}),
	page: Schema.optionalWith(Schema.Number, { exact: true }),
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
