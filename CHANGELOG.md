# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.3]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.3
[0.0.2]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.2
[0.0.1]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.1
