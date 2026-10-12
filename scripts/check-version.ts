/**
 * Fail unless package.json, manifest.json, and versions.json agree on the
 * release version. Prints the version on success.
 *
 * Usage: bun run scripts/check-version.ts
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { Schema } from "effect";

const Manifest = Schema.Struct({
	version: Schema.String,
	minAppVersion: Schema.String,
});
const Package = Schema.Struct({ version: Schema.String });
const Versions = Schema.Record(Schema.String, Schema.String);

const read = <S extends Schema.Decoder<unknown>>(path: string, schema: S) =>
	Schema.decodeUnknownSync(schema)(JSON.parse(readFileSync(path, "utf8")));

const manifest = read("manifest.json", Manifest);
const pkg = read("package.json", Package);
const versions = read("versions.json", Versions);

const problems = [
	pkg.version === manifest.version
		? undefined
		: `package.json ${pkg.version} != manifest.json ${manifest.version}`,
	versions[manifest.version] === manifest.minAppVersion
		? undefined
		: `versions.json must map ${manifest.version} to ${manifest.minAppVersion}`,
].filter((problem) => problem !== undefined);

if (problems.length > 0) {
	console.error(problems.join("\n"));
	process.exit(1);
}
console.log(manifest.version);
