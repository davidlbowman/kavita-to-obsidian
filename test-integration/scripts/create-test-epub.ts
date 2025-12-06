/**
 * Creates a minimal test EPUB for integration testing.
 * This EPUB includes proper metadata for Kavita to detect.
 *
 * @module
 */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EPUB_DIR = join(import.meta.dir, "..", "books", "TestSeries");
const TEMP_DIR = join(import.meta.dir, "..", "temp-epub");
const EPUB_PATH = join(EPUB_DIR, "TestBook-v01.epub");

// Clean up
rmSync(TEMP_DIR, { recursive: true, force: true });
mkdirSync(TEMP_DIR, { recursive: true });
mkdirSync(EPUB_DIR, { recursive: true });

// EPUB structure
const mimetype = "application/epub+zip";

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">urn:uuid:test-book-001</dc:identifier>
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
    <meta property="belongs-to-collection" id="series">Test Series</meta>
    <meta refines="#series" property="collection-type">series</meta>
    <meta refines="#series" property="group-position">1</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="nav"/>
    <itemref idref="chapter1"/>
  </spine>
</package>`;

const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1</a></li>
    </ol>
  </nav>
</body>
</html>`;

const chapter1Xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
  <h1>Chapter 1: The Beginning</h1>
  <p>This is the first paragraph of the test book. It contains some text that can be highlighted and annotated.</p>
  <p>The second paragraph provides more content for testing annotations. We want to ensure that highlights work correctly across multiple paragraphs.</p>
  <p>Here is a particularly interesting passage that readers might want to highlight: "The journey of a thousand miles begins with a single step."</p>
  <p>And finally, some concluding text for this chapter.</p>
</body>
</html>`;

// Write files
writeFileSync(join(TEMP_DIR, "mimetype"), mimetype);
mkdirSync(join(TEMP_DIR, "META-INF"), { recursive: true });
writeFileSync(join(TEMP_DIR, "META-INF", "container.xml"), containerXml);
mkdirSync(join(TEMP_DIR, "OEBPS"), { recursive: true });
writeFileSync(join(TEMP_DIR, "OEBPS", "content.opf"), contentOpf);
writeFileSync(join(TEMP_DIR, "OEBPS", "nav.xhtml"), navXhtml);
writeFileSync(join(TEMP_DIR, "OEBPS", "chapter1.xhtml"), chapter1Xhtml);

// Create EPUB (ZIP with specific requirements)
// mimetype must be first and uncompressed
rmSync(EPUB_PATH, { force: true });
execSync(`cd "${TEMP_DIR}" && zip -X0 "${EPUB_PATH}" mimetype`, {
	stdio: "inherit",
});
execSync(`cd "${TEMP_DIR}" && zip -Xr9D "${EPUB_PATH}" META-INF OEBPS`, {
	stdio: "inherit",
});

// Clean up temp dir
rmSync(TEMP_DIR, { recursive: true, force: true });

console.log(`Created test EPUB at: ${EPUB_PATH}`);
