# Contributing to Kavita Sync

This guide covers the development setup, branch and release flow, code conventions, and tests.

## Prerequisites

- [Bun](https://bun.sh/) 1.3+ (the exact version is pinned in `package.json` → `packageManager`)
- Node.js 24 (Vitest runs on Node)
- [Docker](https://www.docker.com/) for the live Kavita integration tests

## Setup

```bash
git clone https://github.com/davidlbowman/kavita-to-obsidian.git
cd kavita-to-obsidian
bun install
bun run check
```

`bun run check` is the same gate CI runs: oxlint (type-aware) and oxfmt, the Obsidian ESLint rules, `tsc` (TypeScript 7), unit tests with coverage thresholds, and a production build.

| Command                                                            | What it does                                                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `bun run dev`                                                      | Development build with inline source maps                                                      |
| `bun run build`                                                    | Minified production build (`main.js`)                                                          |
| `bun run lint` / `lint:fix`                                        | oxlint (type-aware) + oxfmt check / auto-fix                                                   |
| `bun run format`                                                   | Format with oxfmt                                                                              |
| `bun run dev:vault`                                                | Build, start a seeded Kavita, and open a ready-made Obsidian test vault                        |
| `bun run review:scan`                                              | Approximate the Obsidian community review: whole-repo lint, bundle API check, dependency audit |
| `bun run lint:obsidian`                                            | Obsidian plugin review rules (must pass before release)                                        |
| `bun run typecheck`                                                | `tsc --noEmit`                                                                                 |
| `bun run test` / `test:watch` / `test:coverage`                    | Unit tests                                                                                     |
| `bun run integration`                                              | Fresh Kavita container + live integration tests                                                |
| `bun run integration:up` / `integration:test` / `integration:down` | The same, step by step                                                                         |

## Branches and releases

```
feature branch ──PR──▶ staging ──PR──▶ main ──▶ GitHub release
```

1. Branch from `staging` (`feat/…`, `fix/…`, `chore/…`) and open a PR **into `staging`**. Reference issues with `Refs #N`.
2. CI must be green: the `check` job and the live Kavita jobs (0.8.8 and 0.9.1). Feature PRs are **squash-merged** into `staging` (the only method GitHub allows there).
3. Before a release, try it by hand with `bun run dev:vault` (see below), run `bun run review:scan`, and run the Obsidian community review on the `staging` branch until it's clean. The `release` skill in `.claude/skills/` has the full checklist, including hotfixes. Then bump the version and open a PR **from `staging` into `main`**, with `Closes #N` for the issues it delivers. CI rejects PRs into `main` from any other branch, and they land as a **merge commit** (the only method allowed on `main`).
4. Merging into `main` publishes the release automatically: the `Release` workflow builds, attests, and creates a GitHub release tagged with the manifest version (Obsidian requires the tag to equal the version, no `v` prefix). If that version is already released, the workflow does nothing.

Both branches are protected by rulesets: changes land only through PRs, and force-pushes and deletion are blocked.

### Bumping the version

Update all three files together; CI fails if they disagree (`bun run scripts/check-version.ts`):

- `package.json` → `version`
- `manifest.json` → `version` (and `minAppVersion` if it changes)
- `versions.json` → add `"<version>": "<minAppVersion>"`

Then add a `CHANGELOG.md` entry.

## Architecture

```
src/
  main.ts                    Plugin entry: settings, commands, ribbon, status bar, auto-sync
  sync.ts                    Wires layers for a sync or connection check; summary text
  schemas.ts                 Every data type: Kavita payloads, settings, books, summaries
  errors.ts                  Tagged errors (Schema.TaggedError)
  services/
    PluginConfig.ts          Validates settings into a SyncConfig (URL, redacted key)
    KavitaClient.ts          Auth-key exchange, current user, annotations, volumes, covers
    ChapterCatalog.ts        Book titles, authors, genres; groups highlights into books
    NoteSync.ts              Writes book notes or the single note, covers, library, cleanup
    SyncProgress.ts          Progress messages for the live notice
    ObsidianVault.ts         Vault reads/writes, book-note index by Kavita ID
    ObsidianApp.ts           The narrow slice of Obsidian's App the plugin uses
    ObsidianHttpClient.ts    HttpClient over Obsidian's requestUrl (bypasses CORS)
  formatters/                Pure: highlights, book/single notes, note merging, links, library base
  ui/                        Setup window, settings tab, template page, sync controller, errors
styles.css                   Highlight-color callouts and plugin UI styles
test-support/FakeApp.ts      In-memory vault used by unit and integration tests
test-integration/            Live Kavita harness (fixtures, seeding, tests, docker-compose)
```

The plugin talks to Kavita with: `POST /api/Plugin/authenticate` (auth key → JWT), `GET /api/Account` (current user id), `POST /api/Annotation/all-filtered` (filtered to the current owner, and re-checked client-side), and `GET /api/Series/volumes`.

## Code conventions

### Effect 4

- Services extend `Context.Service<Self, Shape>()("kavita-to-obsidian/Name")` and expose `layerNoDeps` (requires its dependencies) and, where useful, a `layer` that provides them.
- Errors are `Schema.TaggedError` classes. Map external failures to them at the boundary (see `toKavitaError`).
- Use `Effect.fn("Name.method")` for traced service methods and `Effect.fnUntraced` for helpers.
- Use `DateTime.now` instead of `new Date()` so tests control time.
- Use `Predicate` helpers and `Schema` decoding instead of hand-written type guards or parsing.

### Types

- Every data type is derived from a schema in `schemas.ts` (`type X = typeof X.Type`). Do not write parallel interfaces.
- No `as` casts (including `as const`) and no `!` non-null assertions.

### Style

- JSDoc only: no `//` or `/* */` comments.
- oxfmt formats and oxlint lints (it enforces no `as`, no `!`, and no floating promises); run `bun run lint:fix`.
- ESLint only runs Obsidian's review rules (`eslint-plugin-obsidianmd`), which bundle their own TypeScript. Installs are isolated (`bunfig.toml`) so that doesn't clash with the project's TypeScript 7.
- Follow [Obsidian's plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines): use `app.vault` and `fileManager` rather than the adapter, `normalizePath` on constructed paths, sentence case in UI text, and no default hotkeys.

## Tests

### Unit tests

`src/**/*.test.ts` run under `@effect/vitest`, with `obsidian` aliased to `src/__mocks__/obsidian.ts`.

- **Test data comes from schemas.** Use `it.prop` / `it.effect.prop` with schemas, or `Arbitrary.schema(Schema)` with `Arbitrary.sampleEffect`, and spread overrides for the fields a test cares about. Literal strings are fine for curated vectors (HTML entities, unsafe path characters, template syntax).
- **Use the real services.** Syncer tests run the real `ObsidianVault` over `makeFakeApp()`, and `KavitaClient` tests run against a routed fake `HttpClient`.
- Coverage thresholds (enforced): 95% lines, statements, and functions; 90% branches.

### Live integration tests

`test-integration/live.test.ts` runs the plugin's real services, including `ObsidianHttpClient` (with `requestUrl` backed by `fetch`), against a real Kavita container.

Building the `LiveKavita` layer:

1. Generates fixture EPUBs (`test-integration/fixtures`), with no `zip` binary needed.
2. Waits for Kavita, registers an admin, creates and scans a library.
3. Creates a second user who shares annotations, so tests prove other users' highlights never sync.
4. Resets every annotation to the fixture set, so re-runs against the same container are safe.

```bash
bun run integration                     # Kavita 0.9.1 (default)
KAVITA_VERSION=0.8.8 bun run integration # any jvmilazz0/kavita tag
KAVITA_PORT=5056 bun run integration     # if 5055 is taken
```

CI runs the live suite against 0.8.8 (the minimum supported version) and 0.9.1 on every PR. The `Kavita compatibility` workflow runs it daily against `latest` and `nightly`.

## Trying it in Obsidian

```bash
bun run dev:vault
```

This builds the plugin, starts and seeds Kavita, and opens a throwaway **Kavita Test Vault** in Obsidian with the plugin installed, configured, and hot-reloading. Re-run it after changes. Do this before every `staging` → `main` release.

`bun run dev:vault --fresh` clears the plugin's settings so the first-run setup window appears; the URL and auth key to use are printed at the end.

## Pull request checklist

- [ ] Targets `staging` (or is the `staging` → `main` release PR)
- [ ] `bun run check` passes
- [ ] `bun run integration` passes if you touched Kavita calls, syncing, or the vault
- [ ] Tried it by hand with `bun run dev:vault` before releasing
- [ ] New behaviour has tests; new data types are schemas
- [ ] `CHANGELOG.md` updated for user-visible changes
