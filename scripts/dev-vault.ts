/**
 * One command to try the current branch in a real Obsidian.
 *
 * Builds the plugin, starts and seeds the local Kavita test server, writes a
 * throwaway "Kavita Test Vault" with the plugin installed and configured
 * (plus pjeby/hot-reload, so later runs reload the plugin in a running
 * Obsidian), registers the vault with Obsidian, and opens it.
 *
 * Usage: bun run dev:vault
 *
 * Environment:
 * - OBSIDIAN_TEST_VAULT: vault folder (default: ~/Documents/Kavita Test Vault,
 *   or the Windows Documents folder under WSL)
 * - KAVITA_VERSION / KAVITA_PORT: forwarded to docker compose
 *
 * @module
 */
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { LiveKavita } from "../test-integration/support/LiveKavita.js";

const PLUGIN_ID = "kavita-sync";
const HOT_RELOAD_ID = "hot-reload";
const HOT_RELOAD_URL =
	"https://github.com/pjeby/hot-reload/releases/latest/download";
const VAULT_NAME = "Kavita Test Vault";
const isWsl = process.env.WSL_DISTRO_NAME !== undefined;

const run = (command: string, args: ReadonlyArray<string>) => {
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed`);
	}
};

const capture = (command: string, args: ReadonlyArray<string>): string =>
	execFileSync(command, args, { encoding: "utf8" }).trim();

const windowsPath = (wslPath: string) => capture("wslpath", ["-w", wslPath]);

const windowsHome = (): string =>
	capture("wslpath", [
		capture("cmd.exe", ["/c", "echo %USERPROFILE%"]).replace(/\r/g, ""),
	]);

const userHome = isWsl ? windowsHome() : homedir();

const obsidianConfig = isWsl
	? join(userHome, "AppData", "Roaming", "obsidian", "obsidian.json")
	: process.platform === "darwin"
		? join(
				homedir(),
				"Library",
				"Application Support",
				"obsidian",
				"obsidian.json",
			)
		: join(homedir(), ".config", "obsidian", "obsidian.json");

const obsidianRunning = (): boolean => {
	if (isWsl) {
		return /obsidian\.exe/i.test(capture("tasklist.exe", []));
	}
	return spawnSync("pgrep", ["-if", "obsidian"]).status === 0;
};

const ObsidianVaults = Schema.Struct({
	vaults: Schema.Record(Schema.String, Schema.Struct({ path: Schema.String })),
});

const JsonRecord = Schema.Record(Schema.String, Schema.Unknown);
const JsonStrings = Schema.Array(Schema.String);

const readJson = <S extends Schema.Decoder<unknown>>(
	path: string,
	schema: S,
	fallback: S["Type"],
): S["Type"] =>
	existsSync(path)
		? Schema.decodeUnknownSync(schema)(JSON.parse(readFileSync(path, "utf8")))
		: fallback;

const writeJson = (path: string, value: unknown) =>
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

const download = async (url: string, to: string) => {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Download failed: ${url}`);
	writeFileSync(to, Buffer.from(await response.arrayBuffer()));
};

const vaultDir =
	process.env.OBSIDIAN_TEST_VAULT ?? join(userHome, "Documents", VAULT_NAME);
const obsidianDir = join(vaultDir, ".obsidian");
const pluginDir = join(obsidianDir, "plugins", PLUGIN_ID);
const hotReloadDir = join(obsidianDir, "plugins", HOT_RELOAD_ID);

console.log("Building plugin…");
run("bun", ["run", "build"]);

console.log("Starting Kavita…");
run("bun", ["run", "integration:up"]);

console.log("Seeding Kavita…");
const live = await Effect.runPromise(
	Effect.gen(function* () {
		return yield* LiveKavita;
	}).pipe(Effect.provide(LiveKavita.layer)),
);

console.log(`Writing vault at ${vaultDir}…`);
mkdirSync(pluginDir, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
	writeFileSync(join(pluginDir, file), readFileSync(file));
}
writeFileSync(join(pluginDir, ".hotreload"), "");

const dataPath = join(pluginDir, "data.json");
writeJson(dataPath, {
	...readJson(dataPath, JsonRecord, {}),
	kavitaUrl: live.url,
	kavitaApiKey: live.authKey,
});

if (!existsSync(join(hotReloadDir, "main.js"))) {
	mkdirSync(hotReloadDir, { recursive: true });
	await download(`${HOT_RELOAD_URL}/main.js`, join(hotReloadDir, "main.js"));
	await download(
		`${HOT_RELOAD_URL}/manifest.json`,
		join(hotReloadDir, "manifest.json"),
	);
}

const enabledPath = join(obsidianDir, "community-plugins.json");
const enabled = readJson(enabledPath, JsonStrings, []);
writeJson(enabledPath, [...new Set([...enabled, PLUGIN_ID, HOT_RELOAD_ID])]);

const welcome = join(vaultDir, "Welcome.md");
if (!existsSync(welcome)) {
	writeFileSync(
		welcome,
		`# ${VAULT_NAME}\n\nClick the book icon in the left ribbon (or run "Kavita Sync: Sync annotations") to sync from the local test Kavita at ${live.url}.\n\nKavita web UI: ${live.url} (admin / Admin123!).\n`,
	);
}

const vaultPathForObsidian = isWsl ? windowsPath(vaultDir) : vaultDir;
const config = readJson(obsidianConfig, ObsidianVaults, { vaults: {} });
const registered = Object.values(config.vaults).some(
	(v) => v.path === vaultPathForObsidian,
);

if (!registered && obsidianRunning()) {
	console.log(
		`\nObsidian is running, so the vault can't be registered automatically.\nIn Obsidian: Open another vault → Open folder as vault → ${vaultPathForObsidian}`,
	);
} else {
	if (!registered) {
		writeJson(obsidianConfig, {
			...readJson(obsidianConfig, JsonRecord, {}),
			vaults: {
				...config.vaults,
				[randomBytes(8).toString("hex")]: {
					path: vaultPathForObsidian,
					ts: Date.now(),
				},
			},
		});
	}
	const uri = `obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}`;
	if (isWsl) spawnSync("cmd.exe", ["/c", "start", "", uri]);
	else if (process.platform === "darwin") spawnSync("open", [uri]);
	else spawnSync("xdg-open", [uri]);
}

console.log(`
Ready.
  Vault:   ${vaultPathForObsidian}
  Kavita:  ${live.url} (admin / Admin123!)
  Plugin:  rebuilt and copied; hot-reload picks up changes in a running Obsidian.
First open only: click "Trust author and enable plugins" when Obsidian asks.
Stop Kavita with: bun run integration:down`);
