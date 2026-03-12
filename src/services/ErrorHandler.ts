/**
 * Error handler for displaying user-friendly Obsidian notices from sync errors.
 *
 * @module
 */

import { Match } from "effect";
import { Notice } from "obsidian";
import type { SyncError } from "../errors.js";

/**
 * Base URL for troubleshooting documentation.
 *
 * @since 1.2.0
 * @category Constants
 */
const TROUBLESHOOTING_URL =
	"https://github.com/davidlbowman/kavita-to-obsidian/blob/main/TROUBLESHOOTING.md";

/**
 * Display a troubleshooting notice with a link to the relevant documentation section.
 *
 * @since 1.2.0
 * @category Helpers
 */
const showTroubleshootingNotice = (anchor: string): void => {
	new Notice(`See troubleshooting: ${TROUBLESHOOTING_URL}${anchor}`, 8000);
};

/**
 * Show an actionable Obsidian notice for a sync error.
 *
 * Uses exhaustive pattern matching on the error's `_tag` to ensure
 * all error types are handled at compile time.
 *
 * @since 1.2.0
 * @category Error Handling
 */
export const showErrorNotice = (error: SyncError): void =>
	Match.value(error).pipe(
		Match.tag("KavitaAuthError", () => {
			new Notice("Authentication failed. Check your API key in settings.");
			showTroubleshootingNotice("#authentication-failed");
		}),
		Match.tag("KavitaNetworkError", (e) => {
			if (e.statusCode === 401 || e.statusCode === 403) {
				new Notice("Access denied. Your API key may be invalid or expired.");
				showTroubleshootingNotice("#network-error-status-401403");
			} else if (e.statusCode === 404) {
				new Notice("Kavita server not found. Check your URL in settings.");
				showTroubleshootingNotice("#network-error-status-404");
			} else {
				new Notice(`Cannot reach Kavita: ${e.message}`);
				showTroubleshootingNotice("#connection-refused");
			}
		}),
		Match.tag("KavitaParseError", () => {
			new Notice("Unexpected response - update plugin or server version.");
			showTroubleshootingNotice("#failed-to-parse-response");
		}),
		Match.tag("ObsidianWriteError", (e) => {
			new Notice(`Cannot write to ${e.path}. Check the path is valid.`);
			showTroubleshootingNotice("#failed-to-write-file");
		}),
		Match.tag("ObsidianFolderError", (e) => {
			new Notice(`Folder error: ${e.path}. Check folder name is valid.`);
			showTroubleshootingNotice("#folder-operation-failed");
		}),
		Match.tag("ObsidianFileNotFoundError", (e) => {
			new Notice(`File not found: ${e.path}`);
		}),
		Match.exhaustive,
	);
