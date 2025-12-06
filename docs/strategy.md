# Kavita to Obsidian - Implementation Strategy

## Overview

This document outlines the strategy for syncing annotations/highlights from Kavita to Obsidian using Effect-TS best practices.

## Implementation Plan (Branch by Branch)

### Branch 1: `feat/project-setup`

- [x] Initialize Bun project
- [x] Configure Biome for linting/formatting
- [x] Set up TypeScript
- [x] Create CLAUDE.md and README.md
- [x] Push initial commit

### Branch 2: `feat/effect-foundation`

- [x] Install Effect dependencies (`effect`, `@effect/platform`)
- [x] Install Obsidian types (`obsidian`)
- [x] Set up `src/` directory structure
- [x] Create error types (`src/errors.ts`)
- [x] Create schema definitions (`src/schemas.ts`)
- [x] Create PluginConfig service with EnvConfig layer (`src/services/PluginConfig.ts`)
- [x] Add vitest with `@effect/vitest` integration
- [x] Add GitHub Actions CI workflow

### Branch 3: `feat/kavita-client`

- [x] Create KavitaClient service (`src/services/KavitaClient.ts`)
- [x] Implement `fetchAllAnnotations` method
- [x] Implement `fetchAnnotationsFiltered` method
- [x] Add HTTP client layer composition
- [x] Write tests with mock HTTP client

### Branch 4: `feat/obsidian-adapter`

- [x] Create ObsidianApp context tag (`src/services/ObsidianApp.ts`)
- [x] Create ObsidianAdapter service (`src/services/ObsidianAdapter.ts`)
- [x] Implement `writeFile`, `appendToFile`, `readFile`, `getFile`, `listMarkdownFiles`
- [x] Create mock adapter for testing outside Obsidian
- [x] Write tests for ObsidianAdapter

### Branch 5+6: `feat/annotation-syncer`

- [x] Create pure formatting module (`src/formatters/markdown.ts`)
- [x] Implement `toMarkdown` function
- [x] Support grouping by series/chapter
- [x] Handle spoiler filtering and comment inclusion
- [x] Create AnnotationSyncer service (`src/services/AnnotationSyncer.ts`)
- [x] Implement `syncToFile` for v0.0.1
- [x] Wire up layer composition
- [x] End-to-end test with mock services

### Branch 7: `feat/integration-testing`

- [x] Create Docker Compose setup for Kavita test instance
- [x] Add KavitaAuthClient service for unauthenticated bootstrap
- [x] Extend KavitaClient with library/series/annotation management methods
- [x] Create setup script using our Effect services
- [x] Add integration test structure
- [x] Document testing workflow in README

### Branch 8: `feat/obsidian-plugin`

- [x] Create `manifest.json` for Obsidian
- [x] Create plugin entry point (`src/main.ts`)
- [x] Register "Sync Kavita Annotations" command
- [x] Create settings tab UI
- [x] Build pipeline (Bun bundler for Obsidian compatibility)
- [x] Create ObsidianHttpClient using requestUrl API to bypass CORS
- [x] Test in Obsidian vault

### Branch 9: `release/v0.0.1`

#### Phase 1: Code Quality Refactor

- [x] Run effect-agent to refactor all code to Effect-TS best practices
  - [x] Add `accessors: true` to all Effect.Service classes
  - [x] Use Effect's `Array.groupBy` and `Array.filterMap` in formatters
  - [x] Fix error handling (proper error types, message getters)
  - [x] Extract type guards (isTFile in ObsidianAdapter)
  - [x] Add schema validation (Schema.clamp for matchThreshold)
- [x] Standardize comments to JSDoc only
  - [x] Remove all inline comments (`// comment`)
  - [x] Remove all block comments (`/* comment */`)
  - [x] Convert necessary comments to JSDoc format (`/** @description */`)
  - [x] All public APIs have JSDoc with `@since`, `@category` tags
- [x] Verify all services follow consistent patterns
  - [x] All services use `Effect.Service<T>()("ServiceName", { ... })`
  - [x] All services have `accessors: true` (except PluginConfig which uses `sync`)
  - [x] All services have JSDoc with `@since` and `@category`

#### Phase 2: Documentation

- [x] Update README.md
  - [x] Clear installation instructions (how to copy files to vault)
  - [x] Configuration guide (settings tab descriptions)
  - [x] Usage guide (how to trigger sync)
  - [x] Development setup (bun install, bun run dev, etc.)
  - [x] Testing instructions (unit tests, integration tests)
  - [x] Contributing guidelines (or link to CONTRIBUTING.md)
- [x] Create CONTRIBUTING.md
  - [x] How to set up development environment
  - [x] How to run tests
  - [x] Code style and conventions (Effect-TS patterns, JSDoc only)
  - [x] PR process
- [x] Create CHANGELOG.md
  - [x] v0.0.1 release notes

#### Phase 3: Final Verification

- [ ] Update this strategy.md
  - [ ] Mark Branch 9 as complete
  - [ ] Add notes on what was learned
  - [ ] Refine v0.1.0 roadmap based on experience
- [ ] Verify build artifacts
  - [ ] Document which files to copy (main.js, manifest.json, styles.css)
  - [ ] Test fresh install in clean vault
- [ ] Final testing checklist
  - [ ] `bun run lint` passes
  - [ ] `bun run typecheck` passes
  - [ ] `bun run test` passes
  - [ ] `bun run integration` works
  - [ ] Plugin loads in Obsidian
  - [ ] Sync command works end-to-end
- [ ] Tag release v0.0.1

### Future: `feat/fuzzy-matching` (v0.1.0)

- [ ] Create FileMatcher service
- [ ] Implement fuzzy matching against vault files
- [ ] Update AnnotationSyncer with `syncToMatchedFiles`
- [ ] Add conflict handling with annotation markers

## Kavita Annotation API

Base authentication: JWT token or API key

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/Annotation/all-filtered` | POST | List annotations with filtering, pagination |
| `/api/Annotation/all` | GET | List annotations by chapter (`chapterId`) |
| `/api/Annotation/all-for-series` | GET | List annotations by series (`seriesId`) |
| `/api/Annotation/export-filter` | POST | Export filtered annotations as file |
| `/api/Annotation/export` | POST | Export specific annotation IDs as file |

### Schema Definitions (using Effect Schema)

```typescript
import { Schema } from "effect"

export class AnnotationDto extends Schema.Class<AnnotationDto>("AnnotationDto")({
  id: Schema.Number,
  chapterId: Schema.Number,
  seriesId: Schema.optional(Schema.Number),
  content: Schema.String,
  comment: Schema.optional(Schema.String),
  spoiler: Schema.Boolean,
  highlightSlot: Schema.Number,
  page: Schema.optional(Schema.Number),
  position: Schema.optional(Schema.Number),
  createdAt: Schema.optional(Schema.DateTimeUtc),
  updatedAt: Schema.optional(Schema.DateTimeUtc)
}) {}

export class BrowseAnnotationFilterDto extends Schema.Class<BrowseAnnotationFilterDto>("BrowseAnnotationFilterDto")({
  seriesIds: Schema.optional(Schema.Array(Schema.Number)),
  chapterIds: Schema.optional(Schema.Array(Schema.Number)),
  includeSpoilers: Schema.optional(Schema.Boolean),
  startDate: Schema.optional(Schema.DateTimeUtc),
  endDate: Schema.optional(Schema.DateTimeUtc)
}) {}

export const AnnotationsResponse = Schema.Array(AnnotationDto)
```

## Obsidian Plugin API

### File Operations

```typescript
vault.create(path: string, data: string): Promise<TFile>
vault.modify(file: TFile, data: string): Promise<void>
vault.append(file: TFile, data: string): Promise<void>
```

### Fuzzy Matching (v0.1.0)

```typescript
class FuzzySuggestModal<T> {
  getSuggestions(query: string): FuzzyMatch<T>[]
}

metadataCache.getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null
```

## Version Roadmap

### v0.0.1 - Single File Export

**Goal:** Export all Kavita annotations to a single markdown file.

**Flow:**

1. User configures Kavita server URL + API key in settings
2. User triggers "Sync Annotations" command
3. Plugin calls `/api/Annotation/all-filtered`
4. All annotations rendered to markdown format
5. Write to `kavita-annotations.md` (or configurable path)

**Output Format:**

```markdown
# Kavita Annotations

## Series: Book Title

### Chapter 1

> Highlighted text here

*Note:* User's comment about this highlight

---
```

### v0.1.0 - Fuzzy Match to Existing Files

**Goal:** Match annotations to existing markdown files and append.

**Flow:**

1. Fetch annotations (same as v0.0.1)
2. Group annotations by series/book title
3. For each group:
   - Fuzzy match series name to vault files
   - If match found with confidence > threshold: append annotations
   - If no match: collect into "unmatched" file

**Append Format:**

```markdown
<!-- existing file content -->

<!-- kavita-annotations -->
## Kavita Annotations

> Highlight from page 42

*Note:* My thoughts on this passage
```

## Effect-TS Architecture

### Layer Diagram

```
                         ┌─────────────────────┐
                         │    Plugin Entry     │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
          ┌─────────▼─────────┐     │     ┌────────▼────────┐
          │  AnnotationSyncer │     │     │   PluginConfig  │
          └─────────┬─────────┘     │     └─────────────────┘
                    │               │
     ┌──────────────┼───────────────┼──────────────┐
     │              │               │              │
┌────▼────┐  ┌──────▼──────┐  ┌─────▼─────┐  ┌────▼────┐
│ Kavita  │  │ FileMatcher │  │ Obsidian  │  │ Obsidian│
│ Client  │  │   (v0.1.0)  │  │  Adapter  │  │   App   │
└────┬────┘  └─────────────┘  └───────────┘  └─────────┘
     │
┌────▼────┐
│  Http   │
│ Client  │
└─────────┘
```

### Error Types (using Schema.TaggedError)

```typescript
import { Schema } from "effect"

export class KavitaNetworkError extends Schema.TaggedError<KavitaNetworkError>()(
  "KavitaNetworkError",
  {
    url: Schema.String,
    statusCode: Schema.optional(Schema.Number),
    cause: Schema.optional(Schema.Defect)
  }
) {
  get message(): string {
    return `Network error for ${this.url}${this.statusCode ? ` (${this.statusCode})` : ""}`
  }
}

export class KavitaAuthError extends Schema.TaggedError<KavitaAuthError>()(
  "KavitaAuthError",
  { message: Schema.String }
) {}

export class KavitaParseError extends Schema.TaggedError<KavitaParseError>()(
  "KavitaParseError",
  {
    expected: Schema.String,
    actual: Schema.optional(Schema.Unknown)
  }
) {
  get message(): string {
    return `Parse error: expected ${this.expected}`
  }
}

export type KavitaError = KavitaNetworkError | KavitaAuthError | KavitaParseError

export class ObsidianFileNotFoundError extends Schema.TaggedError<ObsidianFileNotFoundError>()(
  "ObsidianFileNotFoundError",
  { path: Schema.String }
) {
  get message() { return `File not found: ${this.path}` }
}

export class ObsidianWriteError extends Schema.TaggedError<ObsidianWriteError>()(
  "ObsidianWriteError",
  {
    path: Schema.String,
    cause: Schema.optional(Schema.Defect)
  }
) {
  get message() { return `Failed to write to: ${this.path}` }
}

export type ObsidianError = ObsidianFileNotFoundError | ObsidianWriteError
```

### Service Definitions (using Effect.Service)

#### EnvConfig Layer (Environment Variables)

```typescript
import { Config, Effect, Layer, Redacted } from "effect"

// Environment variable configuration for dev/test
const EnvConfig = Config.all({
  kavitaUrl: Config.string("KAVITA_URL").pipe(
    Config.map((s) => new URL(s)),
    Config.withDefault(new URL("http://localhost:5000"))
  ),
  kavitaApiKey: Config.redacted("KAVITA_API_KEY"),
  outputPath: Config.string("OUTPUT_PATH").pipe(
    Config.withDefault("kavita-annotations.md")
  ),
  matchThreshold: Config.number("MATCH_THRESHOLD").pipe(
    Config.withDefault(0.7)
  ),
  includeComments: Config.boolean("INCLUDE_COMMENTS").pipe(
    Config.withDefault(true)
  ),
  includeSpoilers: Config.boolean("INCLUDE_SPOILERS").pipe(
    Config.withDefault(false)
  )
})

// Layer that loads from environment
export const EnvConfigLive = Layer.effect(
  PluginConfig,
  Effect.gen(function* () {
    const config = yield* EnvConfig
    return new PluginConfig(config)
  })
)
```

#### PluginConfig Service

```typescript
import { Effect, Layer, Redacted, Context } from "effect"

// Config interface
export interface PluginConfigShape {
  readonly kavitaUrl: URL
  readonly kavitaApiKey: Redacted.Redacted<string>
  readonly outputPath: string
  readonly matchThreshold: number
  readonly includeComments: boolean
  readonly includeSpoilers: boolean
}

export class PluginConfig extends Effect.Service<PluginConfig>()("PluginConfig", {
  sync: (): PluginConfigShape => ({
    kavitaUrl: new URL("http://localhost:5000"),
    kavitaApiKey: Redacted.make(""),
    outputPath: "kavita-annotations.md",
    matchThreshold: 0.7,
    includeComments: true,
    includeSpoilers: false
  })
}) {
  // From Obsidian plugin settings UI
  static fromSettings(settings: PluginSettings) {
    return Layer.succeed(
      PluginConfig,
      new PluginConfig({
        kavitaUrl: new URL(settings.kavitaUrl),
        kavitaApiKey: Redacted.make(settings.kavitaApiKey),
        outputPath: settings.outputPath,
        matchThreshold: settings.matchThreshold,
        includeComments: settings.includeComments,
        includeSpoilers: settings.includeSpoilers
      })
    )
  }

  // From environment variables (dev/test)
  static fromEnv = EnvConfigLive
}
```

#### Obsidian App Context

```typescript
import type { App } from "obsidian"

export class ObsidianApp extends Context.Tag("ObsidianApp")<ObsidianApp, App>() {}
```

#### KavitaClient Service

```typescript
import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform"
import { FetchHttpClient } from "@effect/platform"

export class KavitaClient extends Effect.Service<KavitaClient>()("KavitaClient", {
  effect: Effect.gen(function*() {
    const httpClient = yield* HttpClient.HttpClient
    const config = yield* PluginConfig

    const client = httpClient.pipe(
      HttpClient.filterStatusOk,
      HttpClient.mapRequest(HttpClientRequest.prependUrl(config.kavitaUrl.href)),
      HttpClient.mapRequest(
        HttpClientRequest.setHeader("x-api-key", Redacted.value(config.kavitaApiKey))
      )
    )

    const fetchAllAnnotations = Effect.gen(function*() {
      const response = yield* client.post("/api/Annotation/all-filtered")
      return yield* HttpClientResponse.schemaBodyJson(AnnotationsResponse)(response)
    }).pipe(
      Effect.mapError((e) => new KavitaNetworkError({
        url: "/api/Annotation/all-filtered",
        cause: e
      })),
      Effect.scoped
    )

    const fetchAnnotationsFiltered = (filter: typeof BrowseAnnotationFilterDto.Type) =>
      Effect.gen(function*() {
        const request = yield* HttpClientRequest.post("/api/Annotation/all-filtered").pipe(
          HttpClientRequest.schemaBodyJson(BrowseAnnotationFilterDto)(filter)
        )
        const response = yield* client.execute(request)
        return yield* HttpClientResponse.schemaBodyJson(AnnotationsResponse)(response)
      }).pipe(
        Effect.mapError((e) => new KavitaNetworkError({
          url: "/api/Annotation/all-filtered",
          cause: e
        })),
        Effect.scoped
      )

    return { fetchAllAnnotations, fetchAnnotationsFiltered }
  }),
  dependencies: [PluginConfig.Default]
}) {}

export const KavitaClientLive = KavitaClient.Default.pipe(
  Layer.provide(FetchHttpClient.layer)
)
```

#### ObsidianAdapter Service

```typescript
import { Effect, Option } from "effect"
import type { TFile } from "obsidian"

export class ObsidianAdapter extends Effect.Service<ObsidianAdapter>()("ObsidianAdapter", {
  effect: Effect.gen(function*() {
    const app = yield* ObsidianApp
    const vault = app.vault

    const writeFile = (path: string, content: string) =>
      Effect.tryPromise({
        try: async () => {
          const existingFile = vault.getAbstractFileByPath(path)
          if (existingFile && existingFile instanceof TFile) {
            await vault.modify(existingFile, content)
          } else {
            await vault.create(path, content)
          }
        },
        catch: (e) => new ObsidianWriteError({ path, cause: e })
      })

    const appendToFile = (path: string, content: string) =>
      Effect.tryPromise({
        try: async () => {
          const file = vault.getAbstractFileByPath(path)
          if (file && file instanceof TFile) {
            await vault.append(file, content)
          } else {
            throw new Error("File does not exist")
          }
        },
        catch: (e) => new ObsidianWriteError({ path, cause: e })
      })

    const getFile = (path: string): Effect.Effect<Option.Option<TFile>, never> =>
      Effect.sync(() => {
        const file = vault.getAbstractFileByPath(path)
        return file instanceof TFile ? Option.some(file) : Option.none()
      })

    const listMarkdownFiles = Effect.sync(() => vault.getMarkdownFiles())

    return { writeFile, appendToFile, getFile, listMarkdownFiles }
  })
}) {}
```

#### AnnotationFormatter (Pure Module)

```typescript
import { Option } from "effect"

export interface FormatOptions {
  readonly includeComments: boolean
  readonly includeSpoilers: boolean
}

const formatAnnotation = (
  annotation: typeof AnnotationDto.Type,
  options: FormatOptions
): Option.Option<string> => {
  if (annotation.spoiler && !options.includeSpoilers) {
    return Option.none()
  }

  let result = `> ${annotation.content}\n`

  if (options.includeComments && annotation.comment) {
    result += `\n*Note:* ${annotation.comment}\n`
  }

  if (annotation.page) {
    result += `\n<small>Page ${annotation.page}</small>\n`
  }

  return Option.some(result)
}

export const toMarkdown = (
  annotations: ReadonlyArray<typeof AnnotationDto.Type>,
  options: FormatOptions
): string => {
  const formatted = annotations
    .map((a) => formatAnnotation(a, options))
    .filter(Option.isSome)
    .map((o) => o.value)

  return [
    "# Kavita Annotations",
    "",
    ...formatted.flatMap((f) => [f, "---", ""])
  ].join("\n")
}
```

#### AnnotationSyncer Service

```typescript
export class AnnotationSyncer extends Effect.Service<AnnotationSyncer>()("AnnotationSyncer", {
  effect: Effect.gen(function*() {
    const kavita = yield* KavitaClient
    const obsidian = yield* ObsidianAdapter
    const config = yield* PluginConfig

    const syncToFile = Effect.gen(function*() {
      const annotations = yield* kavita.fetchAllAnnotations

      const markdown = toMarkdown(annotations, {
        includeComments: config.includeComments,
        includeSpoilers: config.includeSpoilers
      })

      yield* obsidian.writeFile(config.outputPath, markdown)

      return { count: annotations.length }
    })

    return { syncToFile }
  }),
  dependencies: [
    KavitaClient.DefaultWithoutDependencies,
    ObsidianAdapter.DefaultWithoutDependencies
  ]
}) {}
```

### Layer Composition

```typescript
export const PluginLive = Layer.mergeAll(
  KavitaClientLive,
  ObsidianAdapter.Default,
  AnnotationSyncer.Default,
  PluginConfig.Default
)

// Plugin entry point
export const runSync = (app: App, settings: PluginSettings) =>
  Effect.gen(function*() {
    const syncer = yield* AnnotationSyncer
    return yield* syncer.syncToFile
  }).pipe(
    Effect.provide(PluginLive),
    Effect.provide(PluginConfig.fromSettings(settings)),
    Effect.provideService(ObsidianApp, app)
  )
```

### Error Handling

```typescript
const handleSyncErrors = <A, R>(
  effect: Effect.Effect<A, KavitaError | ObsidianError, R>
) =>
  effect.pipe(
    Effect.catchTags({
      KavitaAuthError: (e) =>
        Effect.logError(`Authentication failed: ${e.message}`).pipe(
          Effect.zipRight(Effect.fail(e))
        ),
      KavitaNetworkError: (e) =>
        Effect.logWarning(`Network error: ${e.message}`).pipe(
          Effect.zipRight(Effect.fail(e))
        ),
      ObsidianWriteError: (e) =>
        Effect.logError(`Failed to write: ${e.path}`).pipe(
          Effect.zipRight(Effect.fail(e))
        )
    })
  )
```

### Pagination with Streams (for large annotation sets)

```typescript
import { Stream, Chunk, Option } from "effect"

const fetchAllAnnotationsPaginated = (pageSize: number = 100) =>
  Stream.paginateChunkEffect(0, (page) =>
    Effect.gen(function*() {
      const kavita = yield* KavitaClient
      const response = yield* kavita.fetchAnnotationsFiltered({
        // pagination params would go here
      })
      const hasMore = response.length === pageSize
      return [
        Chunk.fromIterable(response),
        hasMore ? Option.some(page + 1) : Option.none()
      ]
    })
  )
```

### Conflict Handling (v0.1.0)

```typescript
const ANNOTATION_MARKER = "<!-- kavita-annotations -->"

const safeAppend = (path: string, content: string) =>
  Effect.gen(function*() {
    const obsidian = yield* ObsidianAdapter
    const existingFile = yield* obsidian.getFile(path)

    if (Option.isNone(existingFile)) {
      yield* obsidian.writeFile(path, `${ANNOTATION_MARKER}\n${content}`)
      return
    }

    const existingContent = yield* Effect.tryPromise({
      try: () => obsidian.app.vault.read(existingFile.value),
      catch: (e) => new ObsidianWriteError({ path, cause: e })
    })

    if (existingContent.includes(ANNOTATION_MARKER)) {
      const before = existingContent.split(ANNOTATION_MARKER)[0]
      yield* obsidian.writeFile(path, `${before}${ANNOTATION_MARKER}\n${content}`)
    } else {
      yield* obsidian.appendToFile(path, `\n\n${ANNOTATION_MARKER}\n${content}`)
    }
  })
```

## Open Questions

1. **Export format**: Does `/api/Annotation/export` return JSON or a formatted file? Need to test.
2. **Series metadata**: Need to fetch series names to group annotations properly.
3. **Incremental sync**: Track last sync time in plugin data to only fetch new annotations.
