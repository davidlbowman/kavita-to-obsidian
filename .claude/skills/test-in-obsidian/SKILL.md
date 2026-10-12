---
name: test-in-obsidian
description: Set up or refresh the local Obsidian test vault against a seeded local Kavita so the user can try the current branch by hand before a release. Use whenever the user wants to test, try, see, or click through plugin changes locally, or before promoting staging to main.
---

# Test the plugin in a real Obsidian

The user tests every release by hand in a real Obsidian before merging `staging` into `main`. Do all the setup yourself: the user only looks at Obsidian. Never ask them to paste keys, open vaults, toggle settings, or press sync.

## Do it

```bash
bun run dev:vault
```

The command is idempotent and safe to re-run after every code change. It:

1. Builds the plugin (`bun run build`).
2. Starts Kavita in Docker (`bun run integration:up`, default `jvmilazz0/kavita:0.9.1` on http://localhost:5055) and seeds it through `test-integration/support/LiveKavita.ts`. Seeding creates fixture books, an `admin` / `Admin123!` user, a second `reader` user whose shared highlight must never sync, and resets annotations to the fixture set.
3. Gracefully closes Obsidian if it is running (so stale plugin state and windows are gone), clears the vault's `Kavita Annotations` folder (re-seeding changes Kavita ids), and writes the **Kavita Test Vault**. Under WSL this is `C:\Users\<user>\Documents\Kavita Test Vault`; elsewhere it is `~/Documents/Kavita Test Vault` (override with `OBSIDIAN_TEST_VAULT`). The vault gets the built plugin, a `data.json` pre-filled with the Kavita URL and a fresh auth key (the plugin moves it into Obsidian's secret storage on load), sync on startup, covers, the library view, and spoilers on, plus the pjeby/hot-reload plugin for later edits.
4. Registers the vault in Obsidian's `obsidian.json` and relaunches Obsidian on it. It waits (up to 3 minutes) until the plugin records a sync newer than the script's start (`lastSyncedAt` in the plugin's `data.json`), then opens the Embers note.

### Against the user's real Kavita (homelab)

```bash
KAVITA_SERVER=http://homelab:5000 KAVITA_AUTH_KEY=<key> bun run dev:vault
```

This skips the Docker server and writes a separate **Kavita Homelab** vault (override with `OBSIDIAN_VAULT_NAME`). Once the plugin has synced, it opens `Kavita Annotations/Library.base`. Ask the user for a short-lived auth key (Kavita: user settings → manage auth keys); never commit it. The plugin is read-only toward Kavita, and the user's real notes vault is never touched. After it syncs, inspect the vault files for real-data surprises: HTML entities in comments, odd genres or metadata markers, missing covers, and series ordering.

### First-run setup

To test first-run setup: `bun run dev:vault --fresh` clears the plugin's settings so the setup window opens; the script prints the Kavita URL and an auth key to paste into it.

Other versions: `KAVITA_VERSION=0.8.8 bun run dev:vault` (run `bun run integration:down` first to switch versions, because the config volume is version-specific).

## Then tell the user

- Obsidian is open on **Kavita Test Vault**, already synced, showing the Embers note. (Only on a brand-new vault does Obsidian ask once to trust its plugins; if the script reports the sync didn't finish, that prompt is why.)
- Expected result in hierarchical mode: `Kavita Annotations/The Lantern Cycle/Embers.md`, `…/Cinders.md`, and `Kavita Annotations/What If- Questions- Answered/What If- Questions- Answered.md`, each with a cover, a byline, chapter headings, and colored highlight callouts whose page links open Kavita at that highlight. `Kavita Annotations/Library.base` shows the books as cover cards. The reader's highlight ("Iron remembers the shape…") must not appear, and the spoiler only appears (collapsed) with **Include spoilers** on.
- Things worth trying: write text under **My notes** and re-sync (it stays); rename a book note or move it within `Kavita Annotations/` and re-sync (no duplicate); the settings status row's **Test connection**; the **Highlight template** page's live preview; the status bar; the **Open this book in Kavita** command.
- Kavita web UI: http://localhost:5055 (`admin` / `Admin123!`), for adding or deleting highlights and re-syncing (for example, to check orphan cleanup).
- After further code changes, re-run `bun run dev:vault`; hot-reload swaps the plugin in place.
- When finished: `bun run integration:down`.

## Gotchas

- Never point this at the user's real vault. It is always the separate test vault.
- `bun run integration` tears the container down and re-seeds it, which invalidates the auth key in the vault. Re-run `bun run dev:vault` afterwards.
- `bun run integration:up` must never delete `test-integration/.data/books` itself: it is bind-mounted into the running container, and recreating the folder hides the EPUBs from Kavita ("Specified EPUB file not found").
- Before asking for an Obsidian review, run `bun run review:scan` (see the **release** skill).
