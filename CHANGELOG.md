# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2025-12-22

### Removed

- Hierarchical integration tests (used Node.js builtins incompatible with Obsidian plugin environment)

## [1.2.0] - 2025-12-19

### Added

- **User-Friendly Error Handling**
  - Specific, actionable error messages for each error type
  - Links to troubleshooting guide in error notices
  - Type-safe error routing using Effect Match
- **Troubleshooting Guide**
  - New `TROUBLESHOOTING.md` with solutions for common errors
  - Quick-fix table in README linking to detailed solutions
  - Covers authentication, network, parse, and file operation errors

### Technical

- New `ErrorHandler.ts` service for centralized error handling
- 178 unit tests (up from 167)
- 11 new tests for error handling coverage

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

[1.2.1]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/1.2.1
[1.2.0]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/1.2.0
[1.1.0]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/1.1.0
[1.0.0]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/1.0.0
[0.0.3]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.3
[0.0.2]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.2
[0.0.1]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.1
