/**
 * Tests for ErrorHandler notice display.
 *
 * @module
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	capturedNotices,
	clearCapturedNotices,
	getNotice,
} from "../__mocks__/obsidian.js";
import {
	KavitaAuthError,
	KavitaNetworkError,
	KavitaParseError,
	ObsidianFileNotFoundError,
	ObsidianFolderError,
	ObsidianWriteError,
} from "../errors.js";
import { showErrorNotice } from "./ErrorHandler.js";

const TROUBLESHOOTING_URL =
	"https://github.com/davidlbowman/kavita-to-obsidian/blob/main/TROUBLESHOOTING.md";

describe("showErrorNotice", () => {
	beforeEach(() => {
		clearCapturedNotices();
	});

	afterEach(() => {
		clearCapturedNotices();
	});

	describe("KavitaAuthError", () => {
		it("shows authentication failed message with troubleshooting link", () => {
			showErrorNotice(new KavitaAuthError({ reason: "invalid key" }));

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				"Authentication failed. Check your API key in settings.",
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#authentication-failed`,
			);
			expect(getNotice(1).timeout).toBe(8000);
		});
	});

	describe("KavitaNetworkError", () => {
		it("shows access denied for status 401", () => {
			showErrorNotice(
				new KavitaNetworkError({
					url: "http://kavita/api",
					statusCode: 401,
				}),
			);

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				"Access denied. Your API key may be invalid or expired.",
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#network-error-status-401403`,
			);
			expect(getNotice(1).timeout).toBe(8000);
		});

		it("shows access denied for status 403", () => {
			showErrorNotice(
				new KavitaNetworkError({
					url: "http://kavita/api",
					statusCode: 403,
				}),
			);

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				"Access denied. Your API key may be invalid or expired.",
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#network-error-status-401403`,
			);
		});

		it("shows server not found for status 404", () => {
			showErrorNotice(
				new KavitaNetworkError({
					url: "http://kavita/api",
					statusCode: 404,
				}),
			);

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				"Kavita server not found. Check your URL in settings.",
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#network-error-status-404`,
			);
			expect(getNotice(1).timeout).toBe(8000);
		});

		it("shows connection error for status 500", () => {
			const error = new KavitaNetworkError({
				url: "http://kavita/api",
				statusCode: 500,
			});

			showErrorNotice(error);

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				`Cannot reach Kavita: ${error.message}`,
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#connection-refused`,
			);
			expect(getNotice(1).timeout).toBe(8000);
		});

		it("shows connection error when no status code is provided", () => {
			const error = new KavitaNetworkError({
				url: "http://kavita/api",
			});

			showErrorNotice(error);

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				`Cannot reach Kavita: ${error.message}`,
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#connection-refused`,
			);
			expect(getNotice(1).timeout).toBe(8000);
		});
	});

	describe("KavitaParseError", () => {
		it("shows unexpected response message with troubleshooting link", () => {
			showErrorNotice(new KavitaParseError({ expected: "AnnotationDto[]" }));

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				"Unexpected response - update plugin or server version.",
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#failed-to-parse-response`,
			);
			expect(getNotice(1).timeout).toBe(8000);
		});
	});

	describe("ObsidianWriteError", () => {
		it("shows write error with path and troubleshooting link", () => {
			showErrorNotice(new ObsidianWriteError({ path: "notes/annotations.md" }));

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				"Cannot write to notes/annotations.md. Check the path is valid.",
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#failed-to-write-file`,
			);
			expect(getNotice(1).timeout).toBe(8000);
		});
	});

	describe("ObsidianFolderError", () => {
		it("shows folder error with path and troubleshooting link", () => {
			showErrorNotice(
				new ObsidianFolderError({
					path: "Kavita Annotations",
					operation: "create",
				}),
			);

			expect(capturedNotices).toHaveLength(2);
			expect(getNotice(0).message).toBe(
				"Folder error: Kavita Annotations. Check folder name is valid.",
			);
			expect(getNotice(1).message).toBe(
				`See troubleshooting: ${TROUBLESHOOTING_URL}#folder-operation-failed`,
			);
			expect(getNotice(1).timeout).toBe(8000);
		});
	});

	describe("ObsidianFileNotFoundError", () => {
		it("shows file not found message without troubleshooting link", () => {
			showErrorNotice(
				new ObsidianFileNotFoundError({ path: "missing/file.md" }),
			);

			expect(capturedNotices).toHaveLength(1);
			expect(getNotice(0).message).toBe("File not found: missing/file.md");
		});
	});
});
