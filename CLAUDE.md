# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kavita-to-Obsidian is an Obsidian plugin that syncs annotations, highlights, and bookmarks from a Kavita server into an Obsidian vault. Built with Effect-TS and Bun.

## Build Commands

```bash
bun install              # Install dependencies
bun run dev              # Development build
bun run build            # Production build (minified)
bun run lint             # Check linting
bun run lint:fix         # Auto-fix linting issues
bun run typecheck        # TypeScript type checking
bun run test             # Run unit tests
bun run integration      # Run integration tests (requires Docker)
```

## Architecture

Obsidian plugin using TypeScript with Effect-TS for functional error handling and service composition.

```
src/
  main.ts                    # Plugin entry point, registers commands and settings
  schemas.ts                 # Effect Schema definitions (AnnotationDto, etc.)
  errors.ts                  # Tagged error types (KavitaError, ObsidianError)
  index.ts                   # Public module exports
  services/
    PluginConfig.ts          # Configuration service (from settings or env)
    KavitaClient.ts          # Effect Service - HTTP client for Kavita API
    KavitaAuthClient.ts      # Effect Service - Auth/bootstrap operations
    ObsidianAdapter.ts       # Effect Service - Vault file operations
    ObsidianApp.ts           # Context tag for Obsidian App instance
    ObsidianHttpClient.ts    # HTTP client using Obsidian's requestUrl (CORS bypass)
    AnnotationSyncer.ts      # Effect Service - Orchestrates sync workflow
  formatters/
    markdown.ts              # Pure functions to format annotations as markdown
test-integration/
  scripts/                   # Docker setup and test data scripts
  docker-compose.yml         # Kavita test container
manifest.json                # Obsidian plugin manifest
```

## Effect-TS Patterns

### Services

All services use `Effect.Service` with `accessors: true`:

```typescript
export class MyService extends Effect.Service<MyService>()("MyService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const dep = yield* SomeDependency;
    return { method: () => Effect.succeed("result") };
  }),
  dependencies: [SomeDependency.Default],
}) {}
```

### Error Types

Tagged errors using `Schema.TaggedError`:

```typescript
export class KavitaNetworkError extends Schema.TaggedError<KavitaNetworkError>()(
  "KavitaNetworkError",
  { url: Schema.String, cause: Schema.optionalWith(Schema.Defect, { as: "Option" }) }
) {
  get message(): string { return `Network error for ${this.url}`; }
}
```

### Layer Composition

Services are composed via Layers for dependency injection:

```typescript
const SyncerLayer = AnnotationSyncer.Default.pipe(
  Layer.provide(KavitaClientLayer),
  Layer.provide(ObsidianAdapterLayer),
  Layer.provide(ConfigLayer),
);
```

## Code Style

- **JSDoc only**: No inline comments (`//`) or block comments (`/* */`)
- **Biome**: Linting and formatting
- **Effect patterns**: Use `Effect.gen`, tagged errors, Layer composition
- **Immutability**: Prefer `readonly` and `const`

## Kavita API

API documentation: https://www.kavitareader.com/docs/api/#/

Key endpoints:
- `POST /api/Annotation/all-filtered` - Fetch annotations with filtering
- `GET /api/Annotation/all?chapterId=` - Fetch by chapter
- `GET /api/Annotation/all-for-series?seriesId=` - Fetch by series

Auth: API key via `x-api-key` header or JWT token.

## Testing

### Unit Tests

```bash
bun run test
```

Uses `@effect/vitest` for Effect-aware testing with mock Layers.

### Integration Tests

```bash
bun run integration      # Full setup: Docker + test data + verification
bun run integration:up   # Start Kavita container
bun run integration:down # Stop container
bun run integration:clean # Remove all test data
```

## Version Roadmap

- **v0.0.1** (current): Export all annotations to single markdown file
- **v0.1.0** (planned): Fuzzy match annotations to existing vault files

See `docs/strategy.md` for detailed implementation plan.
