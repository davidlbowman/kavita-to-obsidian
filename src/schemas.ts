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
