/**
 * Turn sync errors into actionable Obsidian notices.
 *
 * @module
 */
import { Match, Schema } from "effect";
import { Notice } from "obsidian";
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
 * What to tell the user about a failed sync.
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

/**
 * Describe a sync error for the user, with a troubleshooting anchor.
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
				"Kavita rejected your auth key. Check it in the plugin settings.",
			anchor: "#authentication-failed",
		}),
		KavitaNetworkError: (e) =>
			e.statusCode === 404
				? {
						message: "Kavita endpoint not found. Check your server URL.",
						anchor: "#network-error-status-404",
					}
				: {
						message: `Cannot reach Kavita: ${e.message}`,
						anchor: "#connection-refused",
					},
		KavitaParseError: (e) => ({
			message: `Unexpected response from Kavita (${e.endpoint}). Your server version may be unsupported.`,
			anchor: "#failed-to-parse-response",
		}),
		ObsidianWriteError: (e) => ({
			message: `Cannot write ${e.path}. Check the path is valid.`,
			anchor: "#failed-to-write-file",
		}),
		ObsidianFolderError: (e) => ({
			message: `Cannot ${e.operation} folder ${e.path}. Check the folder name is valid.`,
			anchor: "#folder-operation-failed",
		}),
	});

/**
 * Show the error and a link to its troubleshooting section.
 *
 * @since 1.2.0
 * @category Error Notice
 */
export const showErrorNotice = (error: SyncError): void => {
	const { message, anchor } = describeSyncError(error);
	new Notice(message);
	new Notice(`See troubleshooting: ${TROUBLESHOOTING_URL}${anchor}`, 8000);
};
