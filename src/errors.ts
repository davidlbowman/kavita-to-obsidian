/**
 * Tagged error types for Kavita and Obsidian operations.
 *
 * @module
 */
import { Schema } from "effect";

/**
 * Network error when calling Kavita API.
 *
 * @since 0.0.1
 * @category Kavita Errors
 */
export class KavitaNetworkError extends Schema.TaggedErrorClass<KavitaNetworkError>()(
	"KavitaNetworkError",
	{
		url: Schema.String,
		statusCode: Schema.optionalKey(Schema.Number),
		cause: Schema.optionalKey(Schema.Defect),
	},
) {
	override get message(): string {
		const status =
			this.statusCode !== undefined ? ` (status ${this.statusCode})` : "";
		return `Network error calling ${this.url}${status}`;
	}
}

/**
 * Authentication error when calling Kavita API.
 *
 * @since 0.0.1
 * @category Kavita Errors
 */
export class KavitaAuthError extends Schema.TaggedErrorClass<KavitaAuthError>()(
	"KavitaAuthError",
	{
		reason: Schema.String,
	},
) {
	override get message(): string {
		return `Authentication failed: ${this.reason}`;
	}
}

/**
 * Parse error when decoding Kavita API response.
 *
 * @since 0.0.1
 * @category Kavita Errors
 */
export class KavitaParseError extends Schema.TaggedErrorClass<KavitaParseError>()(
	"KavitaParseError",
	{
		expected: Schema.String,
		actual: Schema.optionalKey(Schema.Unknown),
	},
) {
	override get message(): string {
		return `Failed to parse response: expected ${this.expected}`;
	}
}

/**
 * Union of all Kavita API errors.
 *
 * @since 0.0.1
 * @category Kavita Errors
 */
export type KavitaError =
	| KavitaNetworkError
	| KavitaAuthError
	| KavitaParseError;

/**
 * File not found in Obsidian vault.
 *
 * @since 0.0.1
 * @category Obsidian Errors
 */
export class ObsidianFileNotFoundError extends Schema.TaggedErrorClass<ObsidianFileNotFoundError>()(
	"ObsidianFileNotFoundError",
	{
		path: Schema.String,
	},
) {
	override get message(): string {
		return `File not found: ${this.path}`;
	}
}

/**
 * Error writing to Obsidian vault.
 *
 * @since 0.0.1
 * @category Obsidian Errors
 */
export class ObsidianWriteError extends Schema.TaggedErrorClass<ObsidianWriteError>()(
	"ObsidianWriteError",
	{
		path: Schema.String,
		cause: Schema.optionalKey(Schema.Defect),
	},
) {
	override get message(): string {
		return `Failed to write file: ${this.path}`;
	}
}

/**
 * Error with folder operations in Obsidian vault.
 *
 * @since 1.1.0
 * @category Obsidian Errors
 */
export class ObsidianFolderError extends Schema.TaggedErrorClass<ObsidianFolderError>()(
	"ObsidianFolderError",
	{
		path: Schema.String,
		operation: Schema.String,
		cause: Schema.optionalKey(Schema.Defect),
	},
) {
	override get message(): string {
		return `Folder ${this.operation} failed: ${this.path}`;
	}
}

/**
 * Union of all Obsidian errors.
 *
 * @since 0.0.1
 * @category Obsidian Errors
 */
export type ObsidianError =
	| ObsidianFileNotFoundError
	| ObsidianWriteError
	| ObsidianFolderError;

/**
 * Union of all sync-related errors.
 *
 * @since 0.0.1
 * @category Errors
 */
export type SyncError = KavitaError | ObsidianError;
