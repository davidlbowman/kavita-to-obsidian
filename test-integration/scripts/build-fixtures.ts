/**
 * Write the fixture library as EPUBs for the Kavita container to scan.
 *
 * Clears the folder's contents rather than the folder itself, because it is
 * bind-mounted into a possibly running Kavita container.
 *
 * Usage: bun run test-integration/scripts/build-fixtures.ts [outDir]
 *
 * @module
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEpub } from "../fixtures/epub.js";
import { FIXTURE_LIBRARY } from "../fixtures/library.js";

const outDir =
	process.argv[2] ?? join(import.meta.dirname, "..", ".data", "books");

mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) {
	rmSync(join(outDir, entry), { recursive: true, force: true });
}
for (const fixture of FIXTURE_LIBRARY) {
	const folder = join(outDir, fixture.folder);
	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, fixture.fileName), buildEpub(fixture.book));
}
console.log(`Wrote ${FIXTURE_LIBRARY.length} fixture books to ${outDir}`);
