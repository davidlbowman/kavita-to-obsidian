/**
 * Path sanitization utilities for hierarchical folder structure.
 *
 * @module
 */

/**
 * Windows reserved file names that cannot be used.
 *
 * @since 1.1.0
 * @category Path Utilities
 */
const WINDOWS_RESERVED = new Set([
	"CON",
	"PRN",
	"AUX",
	"NUL",
	"COM1",
	"COM2",
	"COM3",
	"COM4",
	"COM5",
	"COM6",
	"COM7",
	"COM8",
	"COM9",
	"LPT1",
	"LPT2",
	"LPT3",
	"LPT4",
	"LPT5",
	"LPT6",
	"LPT7",
	"LPT8",
	"LPT9",
]);

/**
 * Sanitize a string for use as a file or folder name.
 *
 * Handles:
 * - Invalid characters: < > : " / \ | ? *
 * - Windows reserved names: CON, PRN, AUX, NUL, COM1-9, LPT1-9
 * - Whitespace normalization
 * - Length limits (200 chars to leave room for path)
 * - Empty strings
 *
 * @since 1.1.0
 * @category Path Utilities
 */
export const sanitizePathSegment = (name: string): string => {
	let sanitized = name
		.replace(/[<>:"/\\|?*]/g, "-")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200);

	if (sanitized === "") {
		return "Untitled";
	}

	const upperName = sanitized.toUpperCase();
	if (WINDOWS_RESERVED.has(upperName)) {
		sanitized = `${sanitized}_`;
	}

	return sanitized;
};

/**
 * Build a file path from root folder, series name, and book title.
 *
 * @since 1.1.0
 * @category Path Utilities
 */
export const buildBookPath = (
	rootFolder: string,
	seriesName: string,
	bookTitle: string,
): string => {
	const sanitizedSeries = sanitizePathSegment(seriesName);
	const sanitizedBook = sanitizePathSegment(bookTitle);
	return `${rootFolder}/${sanitizedSeries}/${sanitizedBook}.md`;
};

/**
 * Build a folder path for a series.
 *
 * @since 1.1.0
 * @category Path Utilities
 */
export const buildSeriesPath = (
	rootFolder: string,
	seriesName: string,
): string => {
	const sanitizedSeries = sanitizePathSegment(seriesName);
	return `${rootFolder}/${sanitizedSeries}`;
};

/**
 * Handle duplicate book titles by appending chapter ID.
 *
 * @since 1.1.0
 * @category Path Utilities
 */
export const buildUniqueBookPath = (
	rootFolder: string,
	seriesName: string,
	bookTitle: string,
	chapterId: number,
	existingPaths: ReadonlySet<string>,
): string => {
	const basePath = buildBookPath(rootFolder, seriesName, bookTitle);

	if (!existingPaths.has(basePath)) {
		return basePath;
	}

	const sanitizedSeries = sanitizePathSegment(seriesName);
	const sanitizedBook = sanitizePathSegment(bookTitle);
	return `${rootFolder}/${sanitizedSeries}/${sanitizedBook} (ch-${chapterId}).md`;
};
