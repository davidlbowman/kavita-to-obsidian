# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-10-12

### Added

- **Setup window.** On first launch, connect to Kavita step by step: server URL, auth key, **Connect** (shows who you're connected as and how many highlights are ready, or exactly what's wrong), layout and folder, then **Sync now**. Reopen it with **Connect to Kavita**.
- **Beautiful book notes.** Highlights are grouped by chapter in reading order, shown as callouts colored like your Kavita highlights, with your comment inside. Each highlight's page label opens that exact highlight in Kavita's reader. Spoilers appear collapsed.
- **Book covers** downloaded into the vault and shown at the top of each note.
- **Library view.** An optional base shows every book as a cover card, plus a table view grouped by series.
- **Bases-friendly properties:** title, author, series, series index, genres, cover, highlight count, last highlighted, and a link to the book in Kavita.
- **Your edits are kept.** Each note ends with a **My notes** heading; everything you write under it, and your own properties, survive every sync.
- **Rename-safe.** Notes are found by their Kavita ID, so renaming or moving a book note doesn't create a duplicate.
- **Live progress and summaries.** One notice shows progress, then a summary like "12 highlights from 4 books · 2 new" with a link to open your notes. Unchanged notes aren't rewritten.
- **Status bar** (desktop) showing when you last synced; select it to sync.
- **Automatic sync** when Obsidian starts and/or on an interval, quiet unless something new arrives.
- **New settings tab**, searchable, with a status row (**Test connection**, **Sync now**), a folder picker, and a **Highlight template** page with clickable variables and a live preview of your own highlights.
- **Commands:** **Open this book in Kavita**, **Open library**, and an `obsidian://kavita-sync` link that starts a sync.
- The auth key is stored in Obsidian's secure secret storage instead of the vault; existing keys move over automatically.

### Fixed

- **Other users' annotations no longer sync.** On Kavita servers where other users share their annotations, the plugin used to write their highlights into your vault. It now syncs only annotations owned by the auth key's user.
- **"Delete orphaned files" now works.** The setting existed but did nothing. Book notes whose annotations are gone from Kavita are moved to the trash (respecting your trash preference), along with series folders left empty. Only notes the plugin created (frontmatter `kavita_chapter_id`) are touched, and nothing is removed when Kavita returns no annotations at all.
- An invalid server URL now shows a clear settings error instead of "Sync failed unexpectedly".
- Unexpected responses from Kavita now show the "unsupported server version" message; they were previously reported as network errors.
- A corrupt or hand-edited `data.json` no longer prevents the plugin from loading; bad values fall back to their defaults.
- Single-file mode creates missing folders in the output path instead of failing.
- Null author, genre, or chapter lists from Kavita no longer fail the whole sync.
- Server responses with no body (204/304) no longer crash the HTTP client.

### Changed

- Supports Kavita 0.8.8 through 0.9.x, including Kavita 0.9's auth keys. Settings and docs now say "auth key".
- Settings changed by another device (e.g. through Obsidian Sync) are reloaded automatically.
- Starting a sync while one is running shows a notice instead of running twice, and a running sync is cancelled when the plugin unloads.
- Every error now says exactly what's wrong (unreachable server, not a Kavita server, key rejected, server too old) in a single notice with a link to the fix.
- Requires Obsidian 1.13.2 or newer.
- The default highlight template is now a colored callout; settings still holding the old default are upgraded automatically, and custom templates keep working.

### Technical

- Upgraded to Effect 4.0.3 (stable), TypeScript 7, Vitest 5, Obsidian API 1.14, and esbuild 0.28.
- Replaced Biome with oxlint (type-aware, via tsgolint) and oxfmt.
- `bun run dev:vault` sets up a seeded Kavita and a ready-made Obsidian test vault for manual testing.
- Rewrote the services on `Context.Service`, `Schema.TaggedError`, and `effect/http`, with every type derived from a schema.
- New test suites: schema-driven property tests (157 unit tests, ~99.8% coverage), plus live integration tests that run the real plugin against Kavita 0.8.8 and 0.9.1 in Docker on every PR, and against Kavita `latest`/`nightly` daily.
- Added a `staging` branch: features merge to `staging`, and merging `staging` into `main` publishes a release automatically.
- Removed admin-only Kavita calls, the unused series-metadata fetch, and the stress-test scripts from the plugin.

## [1.2.3] - 2026-05-16

### Fixed

- Addressed Obsidian community review warnings.

## [1.2.2] - 2026-05-16

### Fixed

- Passed the Obsidian community automated review.

## [1.2.1] - 2026-03-23

### Fixed

- Switched the bundler from Bun to esbuild so the plugin loads in Obsidian.
- Resolved Obsidian plugin lint violations.

## [1.2.0] - 2026-03-12

### Added

- User-friendly error handling with type-safe error routing using Effect Match
- Specific, actionable error messages for each error type (auth, network, parse, file, folder)
- Error notices link to troubleshooting guide for self-service resolution
- New `ErrorHandler.ts` service for centralized error dispatch
- Comprehensive `TROUBLESHOOTING.md` with solutions for common errors
- Quick-fix troubleshooting table in README

### Changed

- Replaced generic `.catch()` error handling with `Effect.match` pattern
- Replaced inline README troubleshooting with links to TROUBLESHOOTING.md

## [1.1.1] - 2025-12-22

### Removed

- Hierarchical integration tests (used Node.js builtins incompatible with Obsidian plugin environment)

## [1.1.0] - 2025-12-19

### Added

- **Hierarchical Folder Export Mode**
  - New export mode: organize annotations as `Root Folder / Series / Book.md`
  - Each book gets its own markdown file with all its annotations
  - Rich YAML frontmatter with tags for series, author, and genre
  - Wikilinks for series and author names for Obsidian graph integration
  - Configurable root folder name (default: "Kavita Annotations")
- **New Settings**
  - `exportMode` - Choose between "Single file" or "Hierarchical folders"
  - `rootFolderName` - Name of the root folder for hierarchical mode
  - `deleteOrphanedFiles` - Auto-remove files when annotations are deleted
- **Path Sanitization**
  - Safe handling of special characters in series/book names
  - Windows reserved name handling (CON, PRN, etc.)
  - Automatic truncation of very long titles (200 char limit)
  - Duplicate book title handling with chapter ID suffix

### Changed

- Settings UI now shows mode-specific options (output path vs root folder)
- Sync notification shows appropriate message for each mode

### Technical

- New `HierarchicalSyncer` Effect service for folder-based sync
- New `bookFile.ts` formatter for individual book files
- New `paths.ts` utilities for path sanitization
- Added folder operations to `ObsidianAdapter`
- 167 unit tests (up from 127)

## [1.0.0] - 2025-12-08

### Added

- **Stress Testing**
  - Added stress test suite for 10,000 annotations
  - Performance benchmarks for large annotation sets

### Changed

- Promoted to stable v1.0.0 release
- All core features considered production-ready

## [0.0.3] - 2025-12-07

### Changed

- **Improved Annotation Display**
  - Chapter headings now prefixed with "Chapter:" for clarity (e.g., `#### Chapter: Four`)
  - Multi-paragraph annotations now properly blockquote each line
  - Empty notes (null, empty string, or "{}") are now excluded from output
- **Better Obsidian Tagging Defaults**
  - Default `tagPrefix` changed from `kavita/` to empty string
  - Tags now only generated for genres (e.g., `#fiction`, `#sci-fi`)
  - Removed nested tag categories (`book/`, `author/`, `series/`, `library/`)
  - Authors and books are better represented as wikilinks, not tags
- Updated settings UI description for tag prefix

### Fixed

- Multi-paragraph text now renders correctly in blockquotes
- Empty comment marker `{}` from Kavita no longer displayed as a note

## [0.0.2] - 2025-12-06

### Added

- **Enriched Markdown Output**
  - YAML frontmatter with tags and update timestamp
  - Real series, chapter, and library names from Kavita metadata
  - Wikilinks for series and author names (`[[Author Name]]`)
  - Hierarchical tags (`#kavita/series/...`, `#kavita/author/...`, `#kavita/library/...`)
  - Annotations grouped by book within each series
  - Author and genre metadata from series API
- **New Settings**
  - `includeTags` - Toggle Obsidian tag generation
  - `tagPrefix` - Customize tag prefix (default: `kavita/`)
  - `includeWikilinks` - Toggle wikilink generation for series/authors
- **Testing**
  - Unit tests for KavitaAuthClient, ObsidianApp, ObsidianHttpClient
  - Expanded KavitaClient test coverage (all API methods)
  - Coverage thresholds: 80% lines/statements, 70% functions, 60% branches
  - 127 total tests
- **CI Improvements**
  - Manual workflow dispatch trigger for CI

### Changed

- Markdown formatter now produces Obsidian-native output with proper linking
- Annotations display real names instead of numeric IDs

## [0.0.1] - 2025-12-05

### Added

- Initial release of Kavita to Obsidian plugin
- **Core Features**
  - Export all Kavita annotations to a single markdown file
  - Configurable output path for annotation file
  - Option to include/exclude personal comments
  - Option to include/exclude spoiler-marked annotations
  - Annotations grouped by series and chapter
- **Plugin Integration**
  - Settings tab in Obsidian for configuration
  - Ribbon icon for quick sync access
  - Command palette integration ("Sync Kavita Annotations")
- **API Support**
  - Kavita API authentication via API key
  - Fetches annotations using `/api/Annotation/all-filtered` endpoint
- **Developer Experience**
  - Effect-TS architecture for type-safe error handling
  - Comprehensive unit test suite
  - Docker-based integration testing with real Kavita instance
  - Biome for linting and formatting

### Technical Details

- Built with Effect-TS for functional error handling
- Uses Obsidian's `requestUrl` API to bypass CORS restrictions
- Bun bundler for fast builds
- TypeScript with strict mode enabled

[1.2.0]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v1.2.0
[1.1.1]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v1.1.1
[1.1.0]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v1.1.0
[1.0.0]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v1.0.0
[0.0.3]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.3
[0.0.2]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.2
[0.0.1]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.1
