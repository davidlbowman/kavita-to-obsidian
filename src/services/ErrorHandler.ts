/**
 * User-friendly error handling for sync operations.
 *
 * @module
 */
import { Match } from "effect";
import { Notice } from "obsidian";
import type { SyncError } from "../errors.js";

const TROUBLESHOOTING_URL =
	"https://github.com/davidlbowman/kavita-to-obsidian/blob/main/TROUBLESHOOTING.md";

/**
 * Show user-friendly error notices based on error type.
 *
 * @since 1.2.0
 * @category Error Handling
 */
export const showErrorNotice = (error: SyncError): void => {
	Match.value(error).pipe(
		Match.tag("KavitaAuthError", () => {
			new Notice("Authentication failed. Check your API key in settings.");
			new Notice(`See: ${TROUBLESHOOTING_URL}#authentication-failed`, 8000);
		}),
		Match.tag("KavitaNetworkError", (e) => {
			if (e.statusCode === 401 || e.statusCode === 403) {
				new Notice("Access denied. Your API key may be invalid or expired.");
				new Notice(
					`See: ${TROUBLESHOOTING_URL}#network-error-status-401403`,
					8000,
				);
			} else if (e.statusCode === 404) {
				new Notice("Kavita server not found. Check your URL in settings.");
				new Notice(
					`See: ${TROUBLESHOOTING_URL}#network-error-status-404`,
					8000,
				);
			} else {
				new Notice(`Cannot reach Kavita: ${e.message}`);
				new Notice(`See: ${TROUBLESHOOTING_URL}#connection-refused`, 8000);
			}
		}),
		Match.tag("KavitaParseError", () => {
			new Notice("Unexpected response - update plugin or server version.");
			new Notice(`See: ${TROUBLESHOOTING_URL}#failed-to-parse-response`, 8000);
		}),
		Match.tag("ObsidianWriteError", (e) => {
			new Notice(`Cannot write to ${e.path}. Check the path is valid.`);
			new Notice(`See: ${TROUBLESHOOTING_URL}#failed-to-write-file`, 8000);
		}),
		Match.tag("ObsidianFolderError", (e) => {
			new Notice(`Folder error: ${e.path}. Check folder name is valid.`);
			new Notice(`See: ${TROUBLESHOOTING_URL}#folder-operation-failed`, 8000);
		}),
		Match.tag("ObsidianFileNotFoundError", (e) => {
			new Notice(`File not found: ${e.path}`);
		}),
		Match.exhaustive,
	);
};
