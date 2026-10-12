/**
 * Turn sync errors into specific, actionable messages.
 *
 * @module
 */
import { Match, Schema } from "effect";
import type { SyncError } from "../errors.js";

/**
 * Base URL for troubleshooting documentation.
 *
 * @since 1.2.0
 * @category Constants
 */
export const TROUBLESHOOTING_URL =
	"https://github.com/davidlbowman/kavita-to-obsidian/blob/main/TROUBLESHOOTING.md";

/**
 * What to tell the user about a failure.
 *
 * @since 2.0.0
 * @category Error Notice
 */
export const ErrorNoticeContent = Schema.Struct({
	message: Schema.String,
	anchor: Schema.String,
});

/**
 * @since 2.0.0
 * @category Error Notice
 */
export type ErrorNoticeContent = typeof ErrorNoticeContent.Type;

const AUTHENTICATE = "/api/Plugin/authenticate";
const ANNOTATIONS = "/api/Annotation/all-filtered";

/**
 * Describe a sync or connection error for the user, with a troubleshooting
 * anchor.
 *
 * Exhaustive over {@link SyncError}, so new error types fail to compile here
 * until they are given a message.
 *
 * @since 2.0.0
 * @category Error Notice
 */
export const describeSyncError = (error: SyncError): ErrorNoticeContent =>
	Match.valueTags(error, {
		InvalidSettingsError: (e) => ({
			message: e.reason,
			anchor:
				e.setting === "kavitaUrl"
					? "#how-to-verify-your-kavita-url"
					: "#how-to-find-your-kavita-api-key",
		}),
		KavitaAuthError: () => ({
			message:
				"Kavita rejected the auth key. Create a new one and paste it in the plugin settings.",
			anchor: "#authentication-failed",
		}),
		KavitaNetworkError: (e) => {
			if (e.statusCode === 404 && e.endpoint === ANNOTATIONS) {
				return {
					message:
						"This Kavita server doesn't support highlights. Update Kavita to 0.8.8 or newer.",
					anchor: "#failed-to-parse-response",
				};
			}
			if (e.statusCode === 404) {
				return {
					message: "No Kavita server found at that URL. Check the server URL.",
					anchor: "#network-error-status-404",
				};
			}
			if (e.statusCode === undefined) {
				return {
					message:
						"Can't reach the Kavita server. Check that it's running and the URL is right.",
					anchor: "#connection-refused",
				};
			}
			return {
				message: `Kavita answered with an error (${e.statusCode}). Try again shortly.`,
				anchor: "#connection-refused",
			};
		},
		KavitaParseError: (e) =>
			e.endpoint === AUTHENTICATE
				? {
						message:
							"That URL doesn't look like a Kavita server. Check the server URL.",
						anchor: "#how-to-verify-your-kavita-url",
					}
				: {
						message:
							"Kavita sent something unexpected. Your server version may be unsupported.",
						anchor: "#failed-to-parse-response",
					},
		ObsidianWriteError: (e) => ({
			message: `Couldn't write ${e.path}. Check the folder and note names in settings.`,
			anchor: "#failed-to-write-file",
		}),
		ObsidianFolderError: (e) => ({
			message: `Couldn't ${e.operation} the folder ${e.path}. Check the folder name in settings.`,
			anchor: "#folder-operation-failed",
		}),
	});
