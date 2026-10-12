---
name: release
description: Ship a Kavita Sync release end to end — land work on staging, get the Obsidian community review clean on the staging branch, bump the version, promote staging to main, verify the published release, and hotfix when the review on main raises new recommendations. Use whenever the user wants to release, cut a version, promote staging, fix review recommendations, or issue a hotfix.
---

# Releasing Kavita Sync

The flow is `feature branch → staging → main → GitHub release`. Every release bumps the version. The user runs the Obsidian community review ("review branch" on the developer dashboard) on `staging` before promoting, and checks it again on the release from `main`.

## Rules

- **Never commit to `main` or `staging` directly.** Rulesets require PRs: `staging` only accepts **squash** merges, and `main` only accepts **merge commits** from `staging` (CI fails any other source).
- **Every release bumps the version.** Use a patch for fixes and review recommendations, and a minor for features.
- **No AI attribution** in commits or PR bodies (no `Co-Authored-By`).
- **Merging is the user's call.** Merge when they say so. Open PRs as ready, never as drafts.

## 1. Land the work on staging

1. Branch from `origin/staging` (`feat/…`, `fix/…`, `chore/…`).
2. Bump the version in the same PR as the change, or in a follow-up PR before promoting:
   - `package.json` and `manifest.json`: `version`.
   - `versions.json`: add `"X.Y.Z": "<minAppVersion>"`, using the manifest's `minAppVersion`.
   - `CHANGELOG.md`: add a `## [X.Y.Z] - YYYY-MM-DD` entry written for users.
   - Check with `bun run scripts/check-version.ts`, which prints the version or fails on any mismatch.
3. Verify locally before opening the PR:
   - `bun run check`: oxlint and oxfmt, Obsidian ESLint, `tsc`, unit tests with coverage, and the build.
   - `KAVITA_VERSION=0.8.8 bun run integration` and `KAVITA_VERSION=0.9.1 bun run integration`.
   - `bun run review:scan`: the local approximation of the Obsidian review (step 2). It must print "Ready for review."
4. Open the PR into `staging`, wait for CI (the check plus live Kavita 0.8.8 and 0.9.1), and squash-merge when the user approves.

## 2. Get the review clean on staging

1. Have the user try it with the **test-in-obsidian** skill, against the seeded server and against their homelab.
2. Ask the user to run the Obsidian review on the `staging` branch and paste the results.
3. Treat every **warning, recommendation, and disclosure** as work. Fix each one on a new branch into `staging`, then repeat until the review passes cleanly.

What the review checks, and how each has been fixed before:

| Review item                                  | Cause                                                                                                 | Fix                                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Node built-ins (`node:zlib`, …) in any `.ts` | It lints the whole repo, test harness included, except `*.test.ts`, `**/scripts/**`, and config files | Use web-standard APIs (`Uint8Array`, `DataView`, `TextEncoder`)                                                                |
| `fetch`                                      | Direct `fetch` calls, even in test support                                                            | Use Effect's `HttpClient` (`FetchHttpClient`) in tests and `requestUrl` in the plugin                                          |
| `@typescript-eslint/no-unsafe-return`        | Returning `JSON.parse(...)` directly                                                                  | Assign it to an `unknown` first                                                                                                |
| Vulnerable dependency                        | `bun.lock`, including transitive deps of dev tools                                                    | Add `overrides` in `package.json` (`moment`, the review linter's pinned `obsidian`)                                            |
| **Vault enumeration**                        | `vault.getMarkdownFiles()` or `getFiles()`                                                            | Walk only the plugin's folder (`TFolder.children`); see `ObsidianVault.bookNotes(root)`                                        |
| **atob/btoa**                                | Unused library code in the bundle                                                                     | Import Effect HTTP modules per module (`effect/http/HttpClientRequest`), not from `effect/http`, so unused helpers are dropped |
| **Network calls**                            | `requestUrl` call sites                                                                               | Keep one call site (`ObsidianHttpClient`) and list every endpoint in the README's Network & Privacy table                      |
| Build verification and attestations          | Release workflow                                                                                      | Already handled: reproducible esbuild build plus `actions/attest`                                                              |

`bun run review:scan` approximates the lint, bundle, and dependency checks. It can't see everything the real review sees, so the user's review on the branch has the final say.

## 3. Promote staging to main

1. Open a PR `staging → main` titled `Release X.Y.Z`. In the body, list the PRs it contains and put `Closes #N` for each issue it delivers.
2. Wait for CI, including **Main only accepts staging**, and merge with a **merge commit** when the user says so.
3. The Release workflow publishes tag `X.Y.Z` (no `v`) with `main.js`, `manifest.json`, and `styles.css`, and attests `main.js` and `styles.css`. If the tag already exists, it does nothing.
4. Verify:
   - `gh release view X.Y.Z` lists the three assets.
   - `gh release download X.Y.Z -p manifest.json -O -` shows the expected version and `minAppVersion`.
   - Sync local `main`: `git fetch && git switch main && git reset --hard origin/main`.

## 4. Hotfix when the review on main finds something new

The review on the published release sometimes raises recommendations the staging review didn't.

1. Branch from `origin/staging`, which matches `main` after a release, as `fix/…`.
2. Fix it, **bump the patch version** (`X.Y.Z+1`), and add a CHANGELOG entry.
3. Run the step 1 checks (including `bun run review:scan`), open the PR into `staging`, and squash-merge when CI passes and the user approves.
4. Ask the user to re-run the review on `staging`, then promote with a new `Release X.Y.Z+1` PR (step 3).
