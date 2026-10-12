/**
 * Tests for user-facing sync error notices.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
	capturedNotices,
	clearCapturedNotices,
} from "../__mocks__/obsidian.js";
import {
	InvalidSettingsError,
	KavitaAuthError,
	KavitaNetworkError,
	KavitaParseError,
	ObsidianFolderError,
	ObsidianWriteError,
	type SyncError,
} from "../errors.js";
import {
	describeSyncError,
	showErrorNotice,
	TROUBLESHOOTING_URL,
} from "./errorNotice.js";

const slugify = (heading: string): string =>
	heading
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s-]/gu, "")
		.replace(/\s/g, "-");

const troubleshootingAnchors = new Set(
	readFileSync(new URL("../../TROUBLESHOOTING.md", import.meta.url), "utf8")
		.split("\n")
		.flatMap((line) => {
			const heading = /^#{1,6}\s+(.*)$/.exec(line)?.[1];
			return heading === undefined ? [] : [`#${slugify(heading)}`];
		}),
);

const everyError: ReadonlyArray<SyncError> = [
	new InvalidSettingsError({ setting: "kavitaUrl", reason: "Set the URL." }),
	new InvalidSettingsError({ setting: "kavitaApiKey", reason: "Set the key." }),
	new KavitaAuthError({
		endpoint: "/api/Plugin/authenticate",
		statusCode: 401,
	}),
	new KavitaNetworkError({ endpoint: "/api/Series/volumes", statusCode: 404 }),
	new KavitaNetworkError({ endpoint: "/api/Series/volumes", statusCode: 500 }),
	new KavitaNetworkError({ endpoint: "/api/Series/volumes" }),
	new KavitaParseError({
		endpoint: "/api/Annotation/all-filtered",
		cause: "x",
	}),
	new ObsidianWriteError({ path: "Kavita/Book.md" }),
	new ObsidianFolderError({ path: "Kavita", operation: "create" }),
	new ObsidianFolderError({ path: "Kavita/Old", operation: "delete" }),
];

describe("describeSyncError", () => {
	it("links every error to a heading that exists in TROUBLESHOOTING.md", () => {
		for (const error of everyError) {
			expect(troubleshootingAnchors).toContain(describeSyncError(error).anchor);
		}
	});

	it("routes invalid settings to the matching how-to section", () => {
		expect(
			describeSyncError(
				new InvalidSettingsError({ setting: "kavitaUrl", reason: "Bad URL" }),
			),
		).toEqual({ message: "Bad URL", anchor: "#how-to-verify-your-kavita-url" });
		expect(
			describeSyncError(
				new InvalidSettingsError({ setting: "kavitaApiKey", reason: "No key" }),
			),
		).toEqual({
			message: "No key",
			anchor: "#how-to-find-your-kavita-api-key",
		});
	});

	it("explains auth failures", () => {
		expect(
			describeSyncError(
				new KavitaAuthError({ endpoint: "/api/x", statusCode: 403 }),
			),
		).toEqual({
			message:
				"Kavita rejected your auth key. Check it in the plugin settings.",
			anchor: "#authentication-failed",
		});
	});

	it.prop(
		"distinguishes 404s from other network failures",
		{ endpoint: Schema.String },
		({ endpoint }) => {
			expect(
				describeSyncError(
					new KavitaNetworkError({ endpoint, statusCode: 404 }),
				),
			).toEqual({
				message: "Kavita endpoint not found. Check your server URL.",
				anchor: "#network-error-status-404",
			});
			const refused = new KavitaNetworkError({ endpoint });
			expect(describeSyncError(refused)).toEqual({
				message: `Cannot reach Kavita: ${refused.message}`,
				anchor: "#connection-refused",
			});
		},
	);

	it.prop(
		"names the endpoint or path involved",
		{ endpoint: Schema.String, path: Schema.String },
		({ endpoint, path }) => {
			expect(
				describeSyncError(new KavitaParseError({ endpoint, cause: null }))
					.message,
			).toContain(`(${endpoint})`);
			expect(describeSyncError(new ObsidianWriteError({ path })).message).toBe(
				`Cannot write ${path}. Check the path is valid.`,
			);
			expect(
				describeSyncError(
					new ObsidianFolderError({ path, operation: "delete" }),
				).message,
			).toBe(`Cannot delete folder ${path}. Check the folder name is valid.`);
		},
	);
});

describe("showErrorNotice", () => {
	beforeEach(clearCapturedNotices);

	it("shows the message and a lasting troubleshooting link", () => {
		showErrorNotice(
			new KavitaAuthError({ endpoint: "/api/x", statusCode: 401 }),
		);
		expect(capturedNotices).toEqual([
			{
				message:
					"Kavita rejected your auth key. Check it in the plugin settings.",
				timeout: undefined,
			},
			{
				message: `See troubleshooting: ${TROUBLESHOOTING_URL}#authentication-failed`,
				timeout: 8000,
			},
		]);
	});
});
