/**
 * One command to try the current branch in a real Obsidian.
 *
 * Builds the plugin, starts and seeds the local Kavita test server, closes
 * Obsidian if it is running, writes a throwaway "Kavita Test Vault" with the
 * plugin installed and configured to sync on startup (its notes folder is
 * cleared first, since re-seeding Kavita changes its ids) (plus pjeby/hot-reload
 * for later edits), registers the vault, relaunches Obsidian on it, waits for
 * the plugin to sync, and opens a book note. Nothing is left to click.
 *
 * Usage: bun run dev:vault [--fresh]
 *
 * `--fresh` clears the plugin's settings instead, so Obsidian opens on the
 * first-run setup window; the URL and auth key to use are printed.
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
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { LiveKavita } from "../test-integration/support/LiveKavita.js";

const PLUGIN_ID = "kavita-sync";
const HOT_RELOAD_ID = "hot-reload";
const HOT_RELOAD_URL =
	"https://github.com/pjeby/hot-reload/releases/latest/download";
const VAULT_NAME = "Kavita Test Vault";
const NOTES_FOLDER = "Kavita Annotations";
const SHOWCASE_NOTE = `${NOTES_FOLDER}/The Lantern Cycle/Embers.md`;
const fresh = process.argv.includes("--fresh");
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

const closeObsidian = (force = false) => {
	if (isWsl) {
		spawnSync("taskkill.exe", [
			"/IM",
			"Obsidian.exe",
			...(force ? ["/F"] : []),
		]);
	} else {
		spawnSync("pkill", [force ? "-KILL" : "-TERM", "-if", "obsidian"]);
	}
};

const openUri = (uri: string) => {
	if (isWsl) spawnSync("cmd.exe", ["/c", "start", "", uri]);
	else if (process.platform === "darwin") spawnSync("open", [uri]);
	else spawnSync("xdg-open", [uri]);
};

const waitFor = (condition: () => boolean, timeoutMs: number) =>
	new Promise<boolean>((resolve) => {
		const deadline = Date.now() + timeoutMs;
		const tick = () => {
			if (condition()) resolve(true);
			else if (Date.now() > deadline) resolve(false);
			else setTimeout(tick, 1000);
		};
		tick();
	});

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

const vaultPathForObsidian = isWsl ? windowsPath(vaultDir) : vaultDir;
const vaultUri = (file?: string) =>
	`obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}${
		file === undefined ? "" : `&file=${encodeURIComponent(file)}`
	}`;

if (obsidianRunning()) {
	console.log("Closing Obsidian so the vault reloads cleanly…");
	closeObsidian();
	if (!(await waitFor(() => !obsidianRunning(), 20_000))) {
		closeObsidian(true);
		await waitFor(() => !obsidianRunning(), 10_000);
	}
}

console.log(`Writing vault at ${vaultDir}…`);
mkdirSync(pluginDir, { recursive: true });
rmSync(join(vaultDir, NOTES_FOLDER), { recursive: true, force: true });

const dataPath = join(pluginDir, "data.json");
if (fresh) {
	rmSync(dataPath, { force: true });
} else {
	writeJson(dataPath, {
		...readJson(dataPath, JsonRecord, {}),
		kavitaUrl: live.url,
		kavitaApiKey: live.authKey,
		authKeySecret: "",
		exportMode: "hierarchical",
		downloadCovers: true,
		createLibraryView: true,
		includeSpoilers: true,
		syncOnStartup: true,
		setupDismissed: true,
	});
}

for (const file of ["main.js", "manifest.json", "styles.css"]) {
	writeFileSync(join(pluginDir, file), readFileSync(file));
}
writeFileSync(join(pluginDir, ".hotreload"), "");

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

writeFileSync(
	join(vaultDir, "Welcome.md"),
	`# ${VAULT_NAME}

This vault is synced from a local test Kavita at ${live.url} (admin / Admin123!).

Things to look at:

- **Book notes** in \`Kavita Annotations/\`: cover, byline, chapter headings, and highlight callouts colored like Kavita. Each page link opens that highlight in Kavita.
- **Library.base** in \`Kavita Annotations/\`: your books as cover cards.
- **Settings → Kavita Sync**: status row with *Test connection* and *Sync now*, and the *Highlight template* page with a live preview.
- **Status bar** (bottom right): when you last synced. Select it to sync.
- **Your edits**: write anything outside the \`%% kavita-sync %%\` markers, then sync; it stays.
`,
);

const config = readJson(obsidianConfig, ObsidianVaults, { vaults: {} });
if (
	!Object.values(config.vaults).some((v) => v.path === vaultPathForObsidian)
) {
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

console.log("Opening Obsidian…");
openUri(vaultUri());

const showcase = join(vaultDir, SHOWCASE_NOTE);
if (fresh) {
	console.log(
		"Settings were cleared, so the setup window is open in Obsidian.",
	);
} else if (
	await waitFor(
		() =>
			existsSync(showcase) &&
			readFileSync(showcase, "utf8").includes("%% kavita-sync:start"),
		90_000,
	)
) {
	openUri(vaultUri(SHOWCASE_NOTE.replace(/\.md$/, "")));
} else {
	console.log(
		'The plugin didn\'t finish syncing within 90 seconds. If Obsidian asks, select "Trust author and enable plugins".',
	);
}

console.log(`
Ready.
  Vault:     ${vaultPathForObsidian}
  Kavita:    ${live.url} (admin / Admin123!)
  Auth key:  ${live.authKey}
Stop Kavita with: bun run integration:down`);
