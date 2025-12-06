# Kavita to Obsidian

An Obsidian plugin that syncs your annotations, highlights, and bookmarks from [Kavita](https://www.kavitareader.com/) into your Obsidian vault.

## Features

### v0.0.1 (MVP)
- Export all Kavita annotations/highlights to a single markdown file in your vault

### v0.1.0 (Planned)
- Fuzzy match annotations to existing markdown files in your vault
- Append organized annotation data to the bottom of matched files

## Kavita API

This plugin uses the [Kavita API](https://www.kavitareader.com/docs/api/#/) to fetch user data including:
- Bookmarks
- Reading progress
- Annotations/highlights (if available via API)

## Development

This is an Obsidian plugin built with TypeScript.

### Prerequisites
- Node.js 18+
- npm or pnpm

### Setup
```bash
npm install
npm run dev
```

### Building
```bash
npm run build
```

## License

MIT
