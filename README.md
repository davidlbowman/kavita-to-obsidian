# Kavita Sync

Sync your reading highlights and notes from [Kavita](https://www.kavitareader.com/) to your Obsidian vault.

## What It Does

This plugin pulls all your annotations, highlights, and notes from Kavita and organizes them in your Obsidian vault. Choose between two export modes:

### Hierarchical Folders (Recommended)

Organizes annotations as `Root Folder / Series / Book.md`. Each book gets its own markdown file with rich frontmatter for tags and linking.

```
Kavita Annotations/
├── The Great Gatsby/
│   └── The Great Gatsby.md
├── Foundation Series/
│   ├── Foundation.md
│   ├── Foundation and Empire.md
│   └── Second Foundation.md
└── Dune/
    └── Dune.md
```

**Example book file:**

```markdown
---
tags:
  - kavita
  - series/the-great-gatsby
  - author/f-scott-fitzgerald
  - genre/fiction
kavita_series_id: 42
kavita_chapter_id: 123
updated: 2026-10-12T10:30:00.000Z
---

# The Great Gatsby

**Series:** [[The Great Gatsby]]
**Author:** [[F. Scott Fitzgerald]]
**Genres:** Fiction

---

## Annotations

> In my younger and more vulnerable years my father gave me some advice...

_Note:_ This opening is iconic

<small>Page 3</small>

---
```

### Single File

All annotations in one markdown file, grouped by series, book, and chapter.

```markdown
---
title: Kavita Annotations
tags:
  - annotations
  - kavita
updated: 2026-10-12T10:30:00.000Z
---

# Kavita Annotations

## The Great Gatsby

**Series:** [[The Great Gatsby]]
**Library:** Books

### The Great Gatsby

**Author:** [[F. Scott Fitzgerald]]
**Book:** [[The Great Gatsby]]

#### Chapter: One

> In my younger and more vulnerable years...
```

## Requirements

- Kavita **0.8.8 or newer** (the first release with annotations). Tested against 0.8.8 and the latest stable release on every change.
- Obsidian 1.6.6 or newer, desktop or mobile.

## Installation

### From GitHub Release

1. Go to the [Releases](https://github.com/davidlbowman/kavita-to-obsidian/releases) page
2. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
3. In your vault, create the folder `.obsidian/plugins/kavita-sync/`
4. Copy the downloaded files into that folder
5. Restart Obsidian
6. Go to Settings → Community Plugins and enable "Kavita Sync"

### From Community Plugins

Once accepted into Obsidian's Community Plugins directory, install via: Settings → Community Plugins → Browse → search for "Kavita Sync" → click Install → click Enable.

## Setup

### 1. Get a Kavita auth key

- **Kavita 0.9+:** open your profile → **User Settings** → **Manage Auth Keys** and create a key (e.g. "Obsidian").
- **Kavita 0.8.x:** open **User Settings** → **3rd Party Clients** and copy your API key.

See [How to Find Your Kavita API Key](./TROUBLESHOOTING.md#how-to-find-your-kavita-api-key) for details.

### 2. Configure the plugin

1. In Obsidian, go to Settings → **Kavita Sync**
2. Enter your Kavita server URL (e.g., `http://localhost:5000` or `https://kavita.example.com`)
3. Paste your auth key
4. Adjust other settings as desired

## Settings

| Setting                   | What it does                                                                                                                                                                                                                       | Default                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Kavita URL**            | Your Kavita server address (http or https)                                                                                                                                                                                         | -                       |
| **Kavita auth key**       | Auth key (Kavita 0.9+) or API key (0.8.x)                                                                                                                                                                                          | -                       |
| **Export mode**           | "Single file" or "Hierarchical folders"                                                                                                                                                                                            | Hierarchical folders    |
| **Output path**           | Where to save annotations (single file mode); missing folders are created                                                                                                                                                          | `kavita-annotations.md` |
| **Root folder**           | Root folder for book notes (hierarchical mode)                                                                                                                                                                                     | `Kavita Annotations`    |
| **Delete orphaned files** | Move book notes to the trash once their annotations are gone from Kavita. Only notes the plugin created (with `kavita_chapter_id` in frontmatter) are ever touched, and nothing is removed if Kavita returns no annotations at all | On                      |
| **Include comments**      | Include your personal notes with highlights                                                                                                                                                                                        | On                      |
| **Include spoilers**      | Include highlights marked as spoilers                                                                                                                                                                                              | Off                     |
| **Include tags**          | Generate Obsidian tags from genres                                                                                                                                                                                                 | On                      |
| **Tag prefix**            | Prefix for generated genre tags (empty uses `genre/` in book notes)                                                                                                                                                                | (empty)                 |
| **Include wikilinks**     | Create links to author/series notes                                                                                                                                                                                                | On                      |
| **Annotation template**   | How each annotation is rendered; see the setting's description for variables                                                                                                                                                       | Blockquote, note, page  |

Only annotations you own are synced. Highlights that other Kavita users share with you are never written to your vault.

## How to Use

### Sync Your Annotations

**Option 1:** Click the book icon in the left sidebar

**Option 2:** Press `Ctrl/Cmd + P` to open the command palette, then run "Kavita Sync: Sync annotations"

In **hierarchical mode**, each book becomes its own file in a folder structure. In **single file mode**, all annotations are saved to one file.

### Link to Your Annotations

**Hierarchical mode:** Each book is its own note, perfect for Obsidian's graph view and backlinks:

```markdown
See my highlights from [[The Great Gatsby]]
```

**Single file mode:** Link to specific sections:

```markdown
See my highlights from [[kavita-annotations#The Great Gatsby]]
```

If you have notes for authors or series, the wikilinks will automatically connect:

```markdown
**Author:** [[F. Scott Fitzgerald]] ← Links to your author note if it exists
```

## Troubleshooting

For detailed solutions to common issues, see the [Troubleshooting Guide](./TROUBLESHOOTING.md).

**Quick fixes:**

| Error                           | Solution                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Kavita rejected your auth key   | [Create a new auth key](./TROUBLESHOOTING.md#authentication-failed)             |
| Kavita endpoint not found (404) | [Check your Kavita URL](./TROUBLESHOOTING.md#network-error-status-404)          |
| Connection refused              | [Ensure Kavita is running](./TROUBLESHOOTING.md#connection-refused)             |
| No annotations synced           | [Create highlights in Kavita first](./TROUBLESHOOTING.md#no-annotations-synced) |

## Network & Privacy

This plugin connects to your self-hosted Kavita server to sync annotations. Here's what it does:

- **Connects to:** Your configured Kavita server URL only (no third-party services)
- **Authentication:** Exchanges your auth key for a short-lived session token through Kavita's plugin authentication endpoint (`/api/Plugin/authenticate`), then uses that token for every other request
- **Data fetched:** Your account, your annotations, and volume/chapter metadata via Kavita's REST API (read-only; the plugin never modifies anything in Kavita)
- **No telemetry:** The plugin does not collect analytics, usage data, or send information to any external service

## Questions or Issues?

- [Report a bug](https://github.com/davidlbowman/kavita-to-obsidian/issues/new?template=bug_report.md)
- [Request a feature](https://github.com/davidlbowman/kavita-to-obsidian/issues/new?template=feature_request.md)

## Contributing

Want to help improve the plugin? See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
