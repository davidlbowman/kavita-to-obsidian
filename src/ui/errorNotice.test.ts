/**
 * Tests for user-facing sync error notices.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
	InvalidSettingsError,
	KavitaAuthError,
	KavitaNetworkError,
	KavitaParseError,
	ObsidianFolderError,
	ObsidianWriteError,
	type SyncError,
} from "../errors.js";
import { describeSyncError, TROUBLESHOOTING_URL } from "./errorNotice.js";

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
	new KavitaNetworkError({
		endpoint: "/api/Annotation/all-filtered",
		statusCode: 404,
	}),
	new KavitaNetworkError({ endpoint: "/api/Series/volumes", statusCode: 500 }),
	new KavitaNetworkError({ endpoint: "/api/Series/volumes" }),
	new KavitaParseError({
		endpoint: "/api/Annotation/all-filtered",
		cause: "x",
	}),
	new KavitaParseError({ endpoint: "/api/Plugin/authenticate", cause: "x" }),
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
				"Kavita rejected the auth key. Create a new one and paste it in the plugin settings.",
			anchor: "#authentication-failed",
		});
	});

	it("tells an old server apart from a wrong URL", () => {
		expect(
			describeSyncError(
				new KavitaNetworkError({
					endpoint: "/api/Annotation/all-filtered",
					statusCode: 404,
				}),
			).message,
		).toBe(
			"This Kavita server doesn't support highlights. Update Kavita to 0.8.8 or newer.",
		);
		expect(
			describeSyncError(
				new KavitaNetworkError({
					endpoint: "/api/Plugin/authenticate",
					statusCode: 404,
				}),
			),
		).toEqual({
			message: "No Kavita server found at that URL. Check the server URL.",
			anchor: "#network-error-status-404",
		});
	});

	it.prop(
		"separates unreachable servers from server errors",
		{
			endpoint: Schema.String,
			status: Schema.Int.check(Schema.isGreaterThanOrEqualTo(405)),
		},
		({ endpoint, status }) => {
			expect(describeSyncError(new KavitaNetworkError({ endpoint }))).toEqual({
				message:
					"Can't reach the Kavita server. Check that it's running and the URL is right.",
				anchor: "#connection-refused",
			});
			expect(
				describeSyncError(
					new KavitaNetworkError({ endpoint, statusCode: status }),
				).message,
			).toBe(`Kavita answered with an error (${status}). Try again shortly.`);
		},
	);

	it("tells a non-Kavita server apart from an unsupported version", () => {
		expect(
			describeSyncError(
				new KavitaParseError({
					endpoint: "/api/Plugin/authenticate",
					cause: null,
				}),
			),
		).toEqual({
			message:
				"That URL doesn't look like a Kavita server. Check the server URL.",
			anchor: "#how-to-verify-your-kavita-url",
		});
		expect(
			describeSyncError(
				new KavitaParseError({ endpoint: "/api/Series/volumes", cause: null }),
			),
		).toEqual({
			message:
				"Kavita sent something unexpected. Your server version may be unsupported.",
			anchor: "#failed-to-parse-response",
		});
	});

	it.prop(
		"names the path involved in vault failures",
		{ path: Schema.String },
		({ path }) => {
			expect(describeSyncError(new ObsidianWriteError({ path })).message).toBe(
				`Couldn't write ${path}. Check the folder and note names in settings.`,
			);
			expect(
				describeSyncError(
					new ObsidianFolderError({ path, operation: "delete" }),
				).message,
			).toBe(
				`Couldn't delete the folder ${path}. Check the folder name in settings.`,
			);
		},
	);
});

describe("TROUBLESHOOTING_URL", () => {
	it("points at the troubleshooting guide on GitHub", () => {
		expect(TROUBLESHOOTING_URL).toBe(
			"https://github.com/davidlbowman/kavita-to-obsidian/blob/main/TROUBLESHOOTING.md",
		);
	});
});
