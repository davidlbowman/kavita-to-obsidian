# Kavita to Obsidian

An Obsidian plugin that syncs your annotations, highlights, and bookmarks from [Kavita](https://www.kavitareader.com/) into your Obsidian vault.

## Features

### v0.0.1 (Current)

- Export all Kavita annotations to a single markdown file
- Configurable output path
- Option to include/exclude comments and spoilers
- Grouped by series and chapter

### v0.1.0 (Planned)

- Fuzzy match annotations to existing markdown files in your vault
- Append annotations to matched files with configurable threshold

## Installation

### From Community Plugins (Coming Soon)

Once approved, install directly from Obsidian:

1. Open Settings → Community Plugins
2. Click "Browse" and search for "Kavita to Obsidian"
3. Click "Install" then "Enable"

### From GitHub Release

1. Go to the [Releases](https://github.com/davidlbowman/kavita-to-obsidian/releases) page
2. Download `main.js` and `manifest.json` from the latest release
3. Create folder: `<your-vault>/.obsidian/plugins/kavita-to-obsidian/`
4. Copy both files into that folder
5. Restart Obsidian and enable the plugin in Settings → Community Plugins

## Configuration

After enabling the plugin, configure it in Settings → Kavita to Obsidian:

| Setting | Description | Default |
|---------|-------------|---------|
| **Kavita URL** | Your Kavita server URL (e.g., `http://localhost:5000`) | - |
| **Kavita API Key** | Found in Kavita: User Settings → 3rd Party Clients | - |
| **Output Path** | Markdown file path for annotations | `kavita-annotations.md` |
| **Include Comments** | Include your notes with each annotation | `true` |
| **Include Spoilers** | Include annotations marked as spoilers | `false` |

## Usage

### Sync Annotations

**Option 1:** Click the book icon in the left ribbon

**Option 2:** Use the command palette (Ctrl/Cmd + P) → "Sync Kavita Annotations"

### Output Format

Annotations are exported in markdown format, grouped by series and chapter:

```markdown
# Kavita Annotations

## Series Name

### Chapter Title

> Highlighted text from your book

*Comment:* Your note about this highlight

<small>Page 42</small>

---
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- Node.js 18+ (for type definitions)

### Setup

```bash
# Clone the repository
git clone https://github.com/davidlbowman/kavita-to-obsidian.git
cd kavita-to-obsidian

# Install dependencies
bun install

# Development build with watch mode
bun run dev

# Production build
bun run build
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Development build |
| `bun run build` | Production build (minified) |
| `bun run lint` | Check for linting issues |
| `bun run lint:fix` | Auto-fix linting issues |
| `bun run typecheck` | TypeScript type checking |
| `bun run test` | Run unit tests |
| `bun run test:watch` | Run tests in watch mode |

### Testing

#### Unit Tests

```bash
bun run test
```

#### Integration Tests

Integration tests run against a real Kavita instance using Docker:

```bash
# Start Kavita container, create test data, and run setup
bun run integration

# Or run steps individually:
bun run integration:up      # Start Docker container
bun run integration:setup   # Set up test data
bun run integration:down    # Stop container
bun run integration:clean   # Clean up everything
```

### Project Structure

```
src/
  main.ts                    # Plugin entry point
  schemas.ts                 # Effect Schema definitions
  errors.ts                  # Tagged error types
  index.ts                   # Module exports
  services/
    PluginConfig.ts          # Configuration service
    KavitaClient.ts          # Kavita API client
    KavitaAuthClient.ts      # Authentication client
    ObsidianAdapter.ts       # Vault file operations
    ObsidianApp.ts           # Obsidian App context
    ObsidianHttpClient.ts    # HTTP client for Obsidian
    AnnotationSyncer.ts      # Main sync orchestration
  formatters/
    markdown.ts              # Annotation → Markdown formatting
test-integration/
  scripts/                   # Integration test setup
  docker-compose.yml         # Kavita test container
```

## Architecture

Built with [Effect-TS](https://effect.website/) for functional error handling and service composition.

### Key Patterns

- **Effect Services**: All core functionality uses Effect's service pattern with Layer composition
- **Tagged Errors**: Type-safe error handling with discriminated unions (`KavitaError`, `ObsidianError`)
- **Schema Validation**: Request/response validation using Effect Schema
- **Dependency Injection**: Services composed via Layers for testability

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed architecture documentation.

## Kavita API

This plugin uses the [Kavita API](https://www.kavitareader.com/docs/api/#/) to fetch annotations:

- `POST /api/Annotation/all-filtered` - Fetch annotations with filtering

Authentication is handled via API key in the `x-api-key` header.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT
