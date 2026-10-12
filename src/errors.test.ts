/**
 * Tests for error messages.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Schema } from "effect";
import {
	InvalidSettingsError,
	KavitaAuthError,
	KavitaNetworkError,
	KavitaParseError,
	ObsidianFolderError,
	ObsidianWriteError,
} from "./errors.js";

describe("error messages", () => {
	it.prop(
		"InvalidSettingsError reads as its reason",
		{ reason: Schema.String },
		({ reason }) => {
			assert.strictEqual(
				new InvalidSettingsError({ setting: "kavitaUrl", reason }).message,
				reason,
			);
		},
	);

	it.prop(
		"KavitaNetworkError names the endpoint and optional status",
		{ endpoint: Schema.String, statusCode: Schema.Int },
		({ endpoint, statusCode }) => {
			assert.strictEqual(
				new KavitaNetworkError({ endpoint }).message,
				`Network error calling ${endpoint}`,
			);
			assert.strictEqual(
				new KavitaNetworkError({ endpoint, statusCode }).message,
				`Network error calling ${endpoint} (status ${statusCode})`,
			);
		},
	);

	it.prop(
		"KavitaAuthError names the endpoint and status",
		{ endpoint: Schema.String, statusCode: Schema.Int },
		({ endpoint, statusCode }) => {
			assert.strictEqual(
				new KavitaAuthError({ endpoint, statusCode }).message,
				`Authentication failed for ${endpoint} (status ${statusCode})`,
			);
		},
	);

	it.prop(
		"KavitaParseError names the endpoint",
		{ endpoint: Schema.String },
		({ endpoint }) => {
			assert.strictEqual(
				new KavitaParseError({ endpoint, cause: null }).message,
				`Unexpected response from ${endpoint}`,
			);
		},
	);

	it.prop("vault errors name the path", { path: Schema.String }, ({ path }) => {
		assert.strictEqual(
			new ObsidianWriteError({ path }).message,
			`Failed to write file: ${path}`,
		);
		assert.strictEqual(
			new ObsidianFolderError({ path, operation: "delete" }).message,
			`Folder delete failed: ${path}`,
		);
	});
});
