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
export class KavitaNetworkError extends Schema.TaggedError<KavitaNetworkError>()(
	"KavitaNetworkError",
	{
		url: Schema.String,
		statusCode: Schema.optionalWith(Schema.Number, { exact: true }),
		cause: Schema.optionalWith(Schema.Defect, { exact: true }),
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
export class KavitaAuthError extends Schema.TaggedError<KavitaAuthError>()(
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
export class KavitaParseError extends Schema.TaggedError<KavitaParseError>()(
	"KavitaParseError",
	{
		expected: Schema.String,
		actual: Schema.optionalWith(Schema.Unknown, { exact: true }),
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
export class ObsidianFileNotFoundError extends Schema.TaggedError<ObsidianFileNotFoundError>()(
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
export class ObsidianWriteError extends Schema.TaggedError<ObsidianWriteError>()(
	"ObsidianWriteError",
	{
		path: Schema.String,
		cause: Schema.optionalWith(Schema.Defect, { exact: true }),
	},
) {
	override get message(): string {
		return `Failed to write file: ${this.path}`;
	}
}

/**
 * Union of all Obsidian errors.
 *
 * @since 0.0.1
 * @category Obsidian Errors
 */
export type ObsidianError = ObsidianFileNotFoundError | ObsidianWriteError;

/**
 * Union of all sync-related errors.
 *
 * @since 0.0.1
 * @category Errors
 */
export type SyncError = KavitaError | ObsidianError;
