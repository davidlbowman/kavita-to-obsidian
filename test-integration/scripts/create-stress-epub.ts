/**
 * Creates a stress test EPUB with many chapters for testing 10,000+ annotations.
 *
 * @module
 */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EPUB_DIR = join(import.meta.dir, "..", "books", "StressSeries");
const TEMP_DIR = join(import.meta.dir, "..", "temp-epub-stress");
const EPUB_PATH = join(EPUB_DIR, "StressTest-v01.epub");

/** Number of chapters to generate (each chapter will have ~100 paragraphs) */
const NUM_CHAPTERS = 100;
/** Number of paragraphs per chapter */
const PARAGRAPHS_PER_CHAPTER = 100;

rmSync(TEMP_DIR, { recursive: true, force: true });
mkdirSync(TEMP_DIR, { recursive: true });
mkdirSync(EPUB_DIR, { recursive: true });

const mimetype = "application/epub+zip";

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

/**
 * Generate unique paragraph content for annotation testing.
 */
function generateParagraph(chapterNum: number, paragraphNum: number): string {
	const topics = [
		"The ancient scrolls revealed secrets long forgotten by mortal kind.",
		"Lightning crackled across the darkened sky as the storm approached.",
		"In the depths of the forest, mysterious creatures stirred from slumber.",
		"The wizard studied the arcane symbols etched into the stone tablet.",
		"Brave warriors gathered at the castle gates, preparing for battle.",
		"The merchant's caravan wound through treacherous mountain passes.",
		"Whispered legends spoke of treasures hidden beneath the old ruins.",
		"The young apprentice practiced spells by candlelight each evening.",
		"Dragons soared above the clouds, their scales gleaming like jewels.",
		"The kingdom prospered under the wise rule of the benevolent queen.",
	];

	const baseText = topics[(chapterNum + paragraphNum) % topics.length];
	return `[Ch${chapterNum}:P${paragraphNum}] ${baseText} This passage contains important details about the story that readers might want to highlight and annotate for future reference.`;
}

/**
 * Generate chapter XHTML content.
 */
function generateChapter(chapterNum: number): string {
	const paragraphs = Array.from({ length: PARAGRAPHS_PER_CHAPTER }, (_, i) =>
		generateParagraph(chapterNum, i + 1),
	)
		.map((text) => `  <p>${text}</p>`)
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter ${chapterNum}</title></head>
<body>
  <h1>Chapter ${chapterNum}: The Journey Continues</h1>
${paragraphs}
</body>
</html>`;
}

/** Generate manifest items for all chapters */
const manifestItems = Array.from(
	{ length: NUM_CHAPTERS },
	(_, i) =>
		`    <item id="chapter${i + 1}" href="chapter${i + 1}.xhtml" media-type="application/xhtml+xml"/>`,
).join("\n");

/** Generate spine itemrefs for all chapters */
const spineItems = Array.from(
	{ length: NUM_CHAPTERS },
	(_, i) => `    <itemref idref="chapter${i + 1}"/>`,
).join("\n");

const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">urn:uuid:stress-test-001</dc:identifier>
    <dc:title>Stress Test Book</dc:title>
    <dc:creator id="author1">Stress Author</dc:creator>
    <meta refines="#author1" property="role" scheme="marc:relators">aut</meta>
    <dc:subject>Testing</dc:subject>
    <dc:subject>Performance</dc:subject>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
    <meta property="belongs-to-collection" id="series">Stress Series</meta>
    <meta refines="#series" property="collection-type">series</meta>
    <meta refines="#series" property="group-position">1</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifestItems}
  </manifest>
  <spine>
    <itemref idref="nav"/>
${spineItems}
  </spine>
</package>`;

/** Generate TOC entries for all chapters */
const tocEntries = Array.from(
	{ length: NUM_CHAPTERS },
	(_, i) =>
		`      <li><a href="chapter${i + 1}.xhtml">Chapter ${i + 1}</a></li>`,
).join("\n");

const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
${tocEntries}
    </ol>
  </nav>
</body>
</html>`;

console.log(`Creating stress test EPUB with ${NUM_CHAPTERS} chapters...`);
console.log(
	`Total paragraphs: ${NUM_CHAPTERS * PARAGRAPHS_PER_CHAPTER} (supports 10,000 annotations)`,
);

writeFileSync(join(TEMP_DIR, "mimetype"), mimetype);
mkdirSync(join(TEMP_DIR, "META-INF"), { recursive: true });
writeFileSync(join(TEMP_DIR, "META-INF", "container.xml"), containerXml);
mkdirSync(join(TEMP_DIR, "OEBPS"), { recursive: true });
writeFileSync(join(TEMP_DIR, "OEBPS", "content.opf"), contentOpf);
writeFileSync(join(TEMP_DIR, "OEBPS", "nav.xhtml"), navXhtml);

for (let i = 1; i <= NUM_CHAPTERS; i++) {
	writeFileSync(
		join(TEMP_DIR, "OEBPS", `chapter${i}.xhtml`),
		generateChapter(i),
	);
	if (i % 10 === 0) {
		console.log(`  Generated chapter ${i}/${NUM_CHAPTERS}`);
	}
}

rmSync(EPUB_PATH, { force: true });
execSync(`cd "${TEMP_DIR}" && zip -X0 "${EPUB_PATH}" mimetype`, {
	stdio: "inherit",
});
execSync(`cd "${TEMP_DIR}" && zip -Xr9D "${EPUB_PATH}" META-INF OEBPS`, {
	stdio: "inherit",
});

rmSync(TEMP_DIR, { recursive: true, force: true });

console.log(`Created stress test EPUB at: ${EPUB_PATH}`);
