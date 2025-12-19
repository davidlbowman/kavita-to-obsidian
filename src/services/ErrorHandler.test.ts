/**
 * Tests for ErrorHandler module.
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	capturedNotices,
	clearCapturedNotices,
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
		it("shows authentication failed message", () => {
			const error = new KavitaAuthError({ reason: "Invalid API key" });
			showErrorNotice(error);

			expect(capturedNotices).toHaveLength(2);
			expect(capturedNotices[0]?.message).toBe(
				"Authentication failed. Check your API key in settings.",
			);
		});

		it("includes link to troubleshooting guide", () => {
			const error = new KavitaAuthError({ reason: "Invalid API key" });
			showErrorNotice(error);

			expect(capturedNotices[1]?.message).toContain(TROUBLESHOOTING_URL);
			expect(capturedNotices[1]?.message).toContain("#authentication-failed");
			expect(capturedNotices[1]?.timeout).toBe(8000);
		});
	});

	describe("KavitaNetworkError", () => {
		it("shows access denied for 401 status", () => {
			const error = new KavitaNetworkError({
				url: "http://localhost:5000/api/test",
				statusCode: 401,
			});
			showErrorNotice(error);

			expect(capturedNotices[0]?.message).toBe(
				"Access denied. Your API key may be invalid or expired.",
			);
			expect(capturedNotices[1]?.message).toContain(
				"#network-error-status-401403",
			);
		});

		it("shows access denied for 403 status", () => {
			const error = new KavitaNetworkError({
				url: "http://localhost:5000/api/test",
				statusCode: 403,
			});
			showErrorNotice(error);

			expect(capturedNotices[0]?.message).toBe(
				"Access denied. Your API key may be invalid or expired.",
			);
		});

		it("shows server not found for 404 status", () => {
			const error = new KavitaNetworkError({
				url: "http://localhost:5000/api/test",
				statusCode: 404,
			});
			showErrorNotice(error);

			expect(capturedNotices[0]?.message).toBe(
				"Kavita server not found. Check your URL in settings.",
			);
			expect(capturedNotices[1]?.message).toContain(
				"#network-error-status-404",
			);
		});

		it("shows connection error for other status codes", () => {
			const error = new KavitaNetworkError({
				url: "http://localhost:5000/api/test",
				statusCode: 500,
			});
			showErrorNotice(error);

			expect(capturedNotices[0]?.message).toContain("Cannot reach Kavita:");
			expect(capturedNotices[1]?.message).toContain("#connection-refused");
		});

		it("shows connection error when no status code", () => {
			const error = new KavitaNetworkError({
				url: "http://localhost:5000/api/test",
			});
			showErrorNotice(error);

			expect(capturedNotices[0]?.message).toContain("Cannot reach Kavita:");
			expect(capturedNotices[1]?.message).toContain("#connection-refused");
		});
	});

	describe("KavitaParseError", () => {
		it("shows parse error message", () => {
			const error = new KavitaParseError({
				expected: "AnnotationDto",
				actual: { unexpected: "data" },
			});
			showErrorNotice(error);

			expect(capturedNotices[0]?.message).toBe(
				"Unexpected response - update plugin or server version.",
			);
			expect(capturedNotices[1]?.message).toContain(
				"#failed-to-parse-response",
			);
		});
	});

	describe("ObsidianWriteError", () => {
		it("shows write error with path", () => {
			const error = new ObsidianWriteError({
				path: "notes/annotations.md",
			});
			showErrorNotice(error);

			expect(capturedNotices[0]?.message).toBe(
				"Cannot write to notes/annotations.md. Check the path is valid.",
			);
			expect(capturedNotices[1]?.message).toContain("#failed-to-write-file");
		});
	});

	describe("ObsidianFolderError", () => {
		it("shows folder error with path", () => {
			const error = new ObsidianFolderError({
				path: "Kavita Annotations",
				operation: "create",
			});
			showErrorNotice(error);

			expect(capturedNotices[0]?.message).toBe(
				"Folder error: Kavita Annotations. Check folder name is valid.",
			);
			expect(capturedNotices[1]?.message).toContain("#folder-operation-failed");
		});
	});

	describe("ObsidianFileNotFoundError", () => {
		it("shows file not found with path", () => {
			const error = new ObsidianFileNotFoundError({
				path: "missing-file.md",
			});
			showErrorNotice(error);

			expect(capturedNotices).toHaveLength(1);
			expect(capturedNotices[0]?.message).toBe(
				"File not found: missing-file.md",
			);
		});
	});
});
