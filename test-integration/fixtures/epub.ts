/**
 * Minimal, dependency-free EPUB 3 builder for integration fixtures.
 *
 * Writes a STORE-only ZIP so no `zip` binary is needed on the host or in CI,
 * using only web-standard APIs (no Node.js modules).
 *
 * @module
 */
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
	readonly coverColor: readonly [number, number, number];
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
    <meta name="cover" content="cover-image"/>
    <meta property="belongs-to-collection" id="series">${escapeXml(book.series)}</meta>
    <meta refines="#series" property="collection-type">series</meta>
    <meta refines="#series" property="group-position">${book.seriesIndex}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover-image" href="cover.png" media-type="image/png" properties="cover-image"/>
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

const encoder = new TextEncoder();

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	return c >>> 0;
});

/**
 * CRC-32 as used by ZIP and PNG.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export const crc32 = (data: Uint8Array): number => {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
};

const adler32 = (data: Uint8Array): number => {
	let a = 1;
	let b = 0;
	for (const byte of data) {
		a = (a + byte) % 65521;
		b = (b + a) % 65521;
	}
	return ((b << 16) | a) >>> 0;
};

const concat = (parts: ReadonlyArray<Uint8Array>): Uint8Array => {
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
};

const bytes = (size: number, write: (view: DataView) => void): Uint8Array => {
	const out = new Uint8Array(size);
	write(new DataView(out.buffer));
	return out;
};

const u16 = (n: number) => bytes(2, (v) => v.setUint16(0, n, true));
const u32 = (n: number) => bytes(4, (v) => v.setUint32(0, n >>> 0, true));
const u32be = (n: number) => bytes(4, (v) => v.setUint32(0, n >>> 0));

const MAX_STORED_BLOCK = 65535;

/**
 * Wrap data in a zlib stream of uncompressed deflate blocks.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export const zlibStored = (data: Uint8Array): Uint8Array => {
	const blocks: Array<Uint8Array> = [Uint8Array.of(0x78, 0x01)];
	for (let start = 0; start < data.length || start === 0;) {
		const chunk = data.subarray(start, start + MAX_STORED_BLOCK);
		start += MAX_STORED_BLOCK;
		const last = start >= data.length;
		blocks.push(
			Uint8Array.of(last ? 1 : 0),
			u16(chunk.length),
			u16(~chunk.length & 0xffff),
			chunk,
		);
		if (last) break;
	}
	blocks.push(u32be(adler32(data)));
	return concat(blocks);
};

const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
	const body = concat([encoder.encode(type), data]);
	return concat([u32be(data.length), body, u32be(crc32(body))]);
};

const lighten = (channel: number) => Math.min(255, channel + 70);

/**
 * A 300×450 cover in `color` with a lighter band, as a PNG.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export const coverPng = (
	color: readonly [number, number, number],
): Uint8Array => {
	const width = 300;
	const height = 450;
	const [r, g, b] = color;
	const stride = 1 + width * 3;
	const pixels = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const band = y > 150 && y < 230;
		for (let x = 0; x < width; x++) {
			const at = y * stride + 1 + x * 3;
			pixels[at] = band ? lighten(r) : r;
			pixels[at + 1] = band ? lighten(g) : g;
			pixels[at + 2] = band ? lighten(b) : b;
		}
	}
	const header = bytes(13, (v) => {
		v.setUint32(0, width);
		v.setUint32(4, height);
		v.setUint8(8, 8);
		v.setUint8(9, 2);
	});
	return concat([
		Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
		pngChunk("IHDR", header),
		pngChunk("IDAT", zlibStored(pixels)),
		pngChunk("IEND", new Uint8Array(0)),
	]);
};

/**
 * Pack entries into an uncompressed (STORE) ZIP archive.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export const storeZip = (
	entries: ReadonlyArray<readonly [name: string, content: string | Uint8Array]>,
): Uint8Array => {
	const locals: Array<Uint8Array> = [];
	const centrals: Array<Uint8Array> = [];
	let offset = 0;
	for (const [name, content] of entries) {
		const nameBytes = encoder.encode(name);
		const data =
			typeof content === "string" ? encoder.encode(content) : content;
		const shared = concat([
			u16(20),
			u16(0x0800),
			u16(0),
			u16(0),
			u16(0x21),
			u32(crc32(data)),
			u32(data.length),
			u32(data.length),
			u16(nameBytes.length),
			u16(0),
		]);
		const local = concat([u32(0x04034b50), shared, nameBytes, data]);
		centrals.push(
			concat([
				u32(0x02014b50),
				u16(20),
				shared,
				u16(0),
				u16(0),
				u16(0),
				u32(0),
				u32(offset),
				nameBytes,
			]),
		);
		locals.push(local);
		offset += local.length;
	}
	const central = concat(centrals);
	const end = concat([
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(entries.length),
		u16(entries.length),
		u32(central.length),
		u32(offset),
		u16(0),
	]);
	return concat([...locals, central, end]);
};

/**
 * Build a valid EPUB 3 archive for a fixture book.
 *
 * The `mimetype` entry is written first and uncompressed, as the spec requires.
 *
 * @since 2.0.0
 * @category Fixtures
 */
export const buildEpub = (book: EpubBook): Uint8Array =>
	storeZip([
		["mimetype", "application/epub+zip"],
		["META-INF/container.xml", containerXml],
		["OEBPS/content.opf", contentOpf(book)],
		["OEBPS/nav.xhtml", navXhtml(book)],
		["OEBPS/cover.png", coverPng(book.coverColor)],
		...book.chapters.map((chapter, i): readonly [string, string] => [
			`OEBPS/ch${i + 1}.xhtml`,
			chapterXhtml(chapter),
		]),
	]);
