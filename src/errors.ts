/**
 * Tagged error types for settings, Kavita, and Obsidian operations.
 *
 * @module
 */
import { Schema } from "effect";

/**
 * A plugin setting is missing or malformed.
 *
 * @since 2.0.0
 * @category Settings Errors
 */
export class InvalidSettingsError extends Schema.TaggedError<InvalidSettingsError>()(
	"InvalidSettingsError",
	{
		setting: Schema.Literals(["kavitaUrl", "kavitaApiKey"]),
		reason: Schema.String,
	},
) {
	override get message(): string {
		return this.reason;
	}
}

/**
 * Transport failure or unexpected HTTP status from the Kavita API.
 *
 * @since 0.0.1
 * @category Kavita Errors
 */
export class KavitaNetworkError extends Schema.TaggedError<KavitaNetworkError>()(
	"KavitaNetworkError",
	{
		endpoint: Schema.String,
		statusCode: Schema.optionalKey(Schema.Int),
		cause: Schema.optionalKey(Schema.Defect()),
	},
) {
	override get message(): string {
		const status =
			this.statusCode === undefined ? "" : ` (status ${this.statusCode})`;
		return `Network error calling ${this.endpoint}${status}`;
	}
}

/**
 * Kavita rejected the configured auth key.
 *
 * @since 0.0.1
 * @category Kavita Errors
 */
export class KavitaAuthError extends Schema.TaggedError<KavitaAuthError>()(
	"KavitaAuthError",
	{
		endpoint: Schema.String,
		statusCode: Schema.Int,
	},
) {
	override get message(): string {
		return `Authentication failed for ${this.endpoint} (status ${this.statusCode})`;
	}
}

/**
 * A Kavita response did not match the expected schema.
 *
 * @since 0.0.1
 * @category Kavita Errors
 */
export class KavitaParseError extends Schema.TaggedError<KavitaParseError>()(
	"KavitaParseError",
	{
		endpoint: Schema.String,
		cause: Schema.Defect(),
	},
) {
	override get message(): string {
		return `Unexpected response from ${this.endpoint}`;
	}
}

/**
 * Any failure talking to Kavita.
 *
 * @since 0.0.1
 * @category Kavita Errors
 */
export type KavitaError =
	| KavitaNetworkError
	| KavitaAuthError
	| KavitaParseError;

/**
 * Failure writing or trashing a file in the vault.
 *
 * @since 0.0.1
 * @category Obsidian Errors
 */
export class ObsidianWriteError extends Schema.TaggedError<ObsidianWriteError>()(
	"ObsidianWriteError",
	{
		path: Schema.String,
		cause: Schema.optionalKey(Schema.Defect()),
	},
) {
	override get message(): string {
		return `Failed to write file: ${this.path}`;
	}
}

/**
 * Failure creating or trashing a folder in the vault.
 *
 * @since 1.1.0
 * @category Obsidian Errors
 */
export class ObsidianFolderError extends Schema.TaggedError<ObsidianFolderError>()(
	"ObsidianFolderError",
	{
		path: Schema.String,
		operation: Schema.Literals(["create", "delete"]),
		cause: Schema.optionalKey(Schema.Defect()),
	},
) {
	override get message(): string {
		return `Folder ${this.operation} failed: ${this.path}`;
	}
}

/**
 * Any failure touching the vault.
 *
 * @since 0.0.1
 * @category Obsidian Errors
 */
export type ObsidianError = ObsidianWriteError | ObsidianFolderError;

/**
 * Every failure a sync can surface to the user.
 *
 * @since 0.0.1
 * @category Errors
 */
export type SyncError = InvalidSettingsError | KavitaError | ObsidianError;
