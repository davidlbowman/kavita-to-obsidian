# Contributing to Kavita to Obsidian

Thank you for your interest in contributing! This guide covers the development environment setup, code conventions, and PR process.

## Development Environment

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- [Docker](https://www.docker.com/) (for integration tests)
- A text editor with TypeScript support

### Setup

```bash
# Clone and install
git clone https://github.com/davidlbowman/kavita-to-obsidian.git
cd kavita-to-obsidian
bun install

# Run type checking
bun run typecheck

# Run tests
bun run test

# Build the plugin
bun run build
```

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run lint, typecheck, and tests
4. Submit a PR

```bash
# Ensure code quality before committing
bun run lint:fix && bun run typecheck && bun run test
```

## Code Style

### Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
bun run lint        # Check for issues
bun run lint:fix    # Auto-fix issues
bun run format      # Format code
```

### Comments

**Use JSDoc only.** No inline comments (`// ...`) or block comments (`/* ... */`).

```typescript
// Good
/**
 * Fetches all annotations from Kavita.
 * @since 0.0.1
 * @category API
 */
const fetchAllAnnotations = Effect.gen(function* () {
  // ...
});

// Bad
// Fetch all annotations from Kavita
const fetchAllAnnotations = Effect.gen(function* () {
  /* implementation */ // inline comment
});
```

### TypeScript

- Enable strict mode
- Prefer `const` over `let`
- Use `readonly` for immutable properties
- Avoid `any` - use `unknown` with type guards

## Effect-TS Patterns

This project uses [Effect-TS](https://effect.website/) for functional programming patterns.

### Services

All services use `Effect.Service` with the following conventions:

```typescript
import { Effect } from "effect";

/**
 * Description of the service.
 * @since 0.0.1
 * @category Services
 */
export class MyService extends Effect.Service<MyService>()("MyService", {
  accessors: true,
  effect: Effect.gen(function* () {
    // Dependency injection
    const config = yield* PluginConfig;

    // Define methods
    const doSomething = Effect.gen(function* () {
      // Implementation
    });

    return { doSomething };
  }),
  dependencies: [PluginConfig.Default],
}) {}
```

Key points:
- Always include `accessors: true` (except for config services using `sync`)
- Include JSDoc with `@since` and `@category` tags
- Declare dependencies explicitly

### Error Types

Use `Schema.TaggedError` for type-safe error handling:

```typescript
import { Schema } from "effect";

/**
 * Error when network request fails.
 * @since 0.0.1
 * @category Errors
 */
export class NetworkError extends Schema.TaggedError<NetworkError>()(
  "NetworkError",
  {
    url: Schema.String,
    statusCode: Schema.optionalWith(Schema.Number, { as: "Option" }),
    cause: Schema.optionalWith(Schema.Defect, { as: "Option" }),
  }
) {
  get message(): string {
    return `Network error for ${this.url}`;
  }
}
```

### Layer Composition

Compose services using Layers:

```typescript
const FullLayer = Layer.mergeAll(
  ServiceA.Default,
  ServiceB.Default,
).pipe(
  Layer.provide(ConfigLayer),
  Layer.provide(HttpClient.layer),
);
```

### Pure Functions

For utilities without dependencies, use pure modules:

```typescript
// formatters/markdown.ts
import { Option } from "effect";

export const formatAnnotation = (
  annotation: Annotation,
  options: FormatOptions
): Option.Option<string> => {
  if (annotation.spoiler && !options.includeSpoilers) {
    return Option.none();
  }
  return Option.some(`> ${annotation.content}`);
};
```

## Testing

### Running Tests

```bash
bun run test           # Run all tests
bun run test:watch     # Run in watch mode
```

### Coverage Requirements

This project enforces coverage thresholds:

| Metric | Minimum |
|--------|---------|
| Lines | 80% |
| Statements | 80% |
| Functions | 70% |
| Branches | 60% |

Run coverage report:

```bash
bun run test --coverage
```

### Unit Tests

Use `@effect/vitest` for Effect-aware testing:

```typescript
import { describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

describe("MyService", () => {
  it.effect("does something", () =>
    Effect.gen(function* () {
      const service = yield* MyService;
      const result = yield* service.doSomething();
      expect(result).toBe(expected);
    }).pipe(
      Effect.provide(MyService.Default),
      Effect.provide(MockDependencyLayer),
    )
  );
});
```

### Integration Tests

Integration tests run against a real Kavita instance:

```bash
# Full integration test cycle
bun run integration

# Individual steps
bun run integration:up      # Start Docker container
bun run integration:setup   # Set up test data
bun run integration:down    # Stop container
bun run integration:clean   # Clean up everything
```

The integration test environment:
1. Starts a Kavita Docker container
2. Creates a test library with sample EPUBs
3. Registers an admin user
4. Creates sample annotations
5. Runs tests against the live API

## Project Structure

```
kavita-to-obsidian/
├── src/
│   ├── main.ts              # Obsidian plugin entry point
│   ├── schemas.ts           # Effect Schema definitions
│   ├── errors.ts            # Tagged error types
│   ├── index.ts             # Public module exports
│   ├── services/
│   │   ├── PluginConfig.ts      # Configuration service
│   │   ├── KavitaClient.ts      # Main Kavita API client
│   │   ├── KavitaAuthClient.ts  # Auth/bootstrap client
│   │   ├── ObsidianAdapter.ts   # Vault file operations
│   │   ├── ObsidianApp.ts       # Obsidian App context tag
│   │   ├── ObsidianHttpClient.ts # CORS-bypassing HTTP
│   │   └── AnnotationSyncer.ts  # Sync orchestration
│   └── formatters/
│       └── markdown.ts      # Annotation formatting
├── test-integration/
│   ├── scripts/             # Setup scripts
│   └── docker-compose.yml   # Kavita container
├── scripts/
│   └── build.ts             # Bun build script
└── manifest.json            # Obsidian manifest
```

## Pull Request Process

1. **Branch naming**: Use descriptive names like `feat/fuzzy-matching` or `fix/auth-error`

2. **Commit messages**: Use conventional commit format:
   - `feat: add fuzzy file matching`
   - `fix: handle empty annotation response`
   - `refactor: extract formatting logic`
   - `docs: update README installation`
   - `test: add integration tests for sync`

3. **PR checklist**:
   - [ ] Code passes `bun run lint`
   - [ ] Code passes `bun run typecheck`
   - [ ] All tests pass `bun run test`
   - [ ] JSDoc comments for public APIs
   - [ ] No inline/block comments (JSDoc only)

4. **Review process**: PRs require one approval before merging

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes to plugin settings or behavior
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

## Questions?

Open an issue or discussion on GitHub.
