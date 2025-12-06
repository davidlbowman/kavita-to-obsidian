# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-01-XX

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

[0.0.1]: https://github.com/davidlbowman/kavita-to-obsidian/releases/tag/v0.0.1
