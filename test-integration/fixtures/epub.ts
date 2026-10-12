/**
 * Minimal, dependency-free EPUB 3 builder for integration fixtures.
 *
 * Writes a STORE-only ZIP so no `zip` binary is needed on the host or in CI.
 *
 * @module
 */
import { crc32 } from "node:zlib";

/**
 * A single chapter of fixture book content.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export interface EpubChapter {
	readonly title: string;
	readonly paragraphs: ReadonlyArray<string>;
}

/**
 * Metadata and content for a fixture EPUB.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export interface EpubBook {
	readonly id: string;
	readonly title: string;
	readonly authors: ReadonlyArray<string>;
	readonly subjects: ReadonlyArray<string>;
	readonly series: string;
	readonly seriesIndex: number;
	readonly chapters: ReadonlyArray<EpubChapter>;
}

const escapeXml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const contentOpf = (book: EpubBook): string => {
	const creators = book.authors
		.map(
			(author, i) =>
				`<dc:creator id="author${i}">${escapeXml(author)}</dc:creator>\n    <meta refines="#author${i}" property="role" scheme="marc:relators">aut</meta>`,
		)
		.join("\n    ");
	const subjects = book.subjects
		.map((s) => `<dc:subject>${escapeXml(s)}</dc:subject>`)
		.join("\n    ");
	const manifest = book.chapters
		.map(
			(_, i) =>
				`<item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`,
		)
		.join("\n    ");
	const spine = book.chapters
		.map((_, i) => `<itemref idref="ch${i + 1}"/>`)
		.join("\n    ");
	return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${book.id}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    ${creators}
    ${subjects}
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
    <meta property="belongs-to-collection" id="series">${escapeXml(book.series)}</meta>
    <meta refines="#series" property="collection-type">series</meta>
    <meta refines="#series" property="group-position">${book.seriesIndex}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifest}
  </manifest>
  <spine>
    <itemref idref="nav"/>
    ${spine}
  </spine>
</package>`;
};

const navXhtml = (
	book: EpubBook,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      ${book.chapters.map((c, i) => `<li><a href="ch${i + 1}.xhtml">${escapeXml(c.title)}</a></li>`).join("\n      ")}
    </ol>
  </nav>
</body>
</html>`;

const chapterXhtml = (
	chapter: EpubChapter,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXml(chapter.title)}</title></head>
<body>
  <h1>${escapeXml(chapter.title)}</h1>
  ${chapter.paragraphs.map((p) => `<p>${escapeXml(p)}</p>`).join("\n  ")}
</body>
</html>`;

const u16 = (n: number): Buffer => {
	const b = Buffer.alloc(2);
	b.writeUInt16LE(n);
	return b;
};

const u32 = (n: number): Buffer => {
	const b = Buffer.alloc(4);
	b.writeUInt32LE(n >>> 0);
	return b;
};

/**
 * Pack entries into an uncompressed (STORE) ZIP archive.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export const storeZip = (
	entries: ReadonlyArray<readonly [name: string, content: string]>,
): Buffer => {
	const locals: Array<Buffer> = [];
	const centrals: Array<Buffer> = [];
	let offset = 0;
	for (const [name, content] of entries) {
		const nameBuf = Buffer.from(name, "utf8");
		const data = Buffer.from(content, "utf8");
		const crc = crc32(data);
		const shared = Buffer.concat([
			u16(20),
			u16(0x0800),
			u16(0),
			u16(0),
			u16(0x21),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(nameBuf.length),
			u16(0),
		]);
		const local = Buffer.concat([u32(0x04034b50), shared, nameBuf, data]);
		centrals.push(
			Buffer.concat([
				u32(0x02014b50),
				u16(20),
				shared,
				u16(0),
				u16(0),
				u16(0),
				u32(0),
				u32(offset),
				nameBuf,
			]),
		);
		locals.push(local);
		offset += local.length;
	}
	const central = Buffer.concat(centrals);
	const end = Buffer.concat([
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(entries.length),
		u16(entries.length),
		u32(central.length),
		u32(offset),
		u16(0),
	]);
	return Buffer.concat([...locals, central, end]);
};

/**
 * Build a valid EPUB 3 archive for a fixture book.
 *
 * The `mimetype` entry is written first and uncompressed, as the spec requires.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export const buildEpub = (book: EpubBook): Buffer =>
	storeZip([
		["mimetype", "application/epub+zip"],
		["META-INF/container.xml", containerXml],
		["OEBPS/content.opf", contentOpf(book)],
		["OEBPS/nav.xhtml", navXhtml(book)],
		...book.chapters.map((chapter, i): readonly [string, string] => [
			`OEBPS/ch${i + 1}.xhtml`,
			chapterXhtml(chapter),
		]),
	]);
