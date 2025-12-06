# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kavita-to-Obsidian is an Obsidian plugin that syncs annotations, highlights, and bookmarks from a Kavita server into an Obsidian vault. Built with Effect-TS and Bun.

## Build Commands

```bash
bun install          # Install dependencies
bun run dev          # Development build with watch mode
bun run build        # Production build
```

## Architecture

Obsidian plugin using TypeScript with Effect-TS for functional error handling and service composition.

```
src/
  main.ts              # Plugin entry point, registers commands and settings
  services/
    KavitaClient.ts    # Effect Service - HTTP client for Kavita API
    ObsidianAdapter.ts # Effect Service - Vault file operations
    FileMatcher.ts     # Effect Service - Fuzzy matching (v0.1.0)
  formatters/
    markdown.ts        # Pure functions to format annotations as markdown
  errors.ts            # Tagged error types (KavitaError, ObsidianError)
  config.ts            # Plugin settings schema
manifest.json          # Obsidian plugin manifest
```

## Effect Patterns

Use Effect services with Layer composition. Errors are tagged unions:
```typescript
type KavitaError =
  | { _tag: "NetworkError"; cause: unknown }
  | { _tag: "AuthError"; message: string }
  | { _tag: "ParseError"; cause: unknown }
```

## Kavita API

API documentation: https://www.kavitareader.com/docs/api/#/

Key annotation endpoints:
- `POST /api/Annotation/all-filtered` - List with filtering/pagination
- `GET /api/Annotation/all?chapterId=` - List by chapter
- `POST /api/Annotation/export` - Export specific annotation IDs

Auth: API key or JWT token.

## Versioning Roadmap

- **v0.0.1**: Export all annotations to a single markdown file
- **v0.1.0**: Fuzzy match annotations to existing vault files, append to matched files
