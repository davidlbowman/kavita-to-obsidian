# Kavita to Obsidian

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
  - fiction
  - classic
kavita_series_id: 42
kavita_chapter_id: 123
updated: 2025-12-19T10:30:00Z
---

# The Great Gatsby

**Series:** [[The Great Gatsby]]
**Author:** [[F. Scott Fitzgerald]]

## Annotations

#### Chapter: One

> In my younger and more vulnerable years my father gave me some advice...

*Note:* This opening is iconic

Page 3

---

> So we beat on, boats against the current...

Page 180
```

### Single File

All annotations in one markdown file, grouped by series and chapter.

```markdown
---
tags:
  - kavita
  - annotations
updated: 2025-12-06T10:30:00Z
---

# Kavita Annotations

## The Great Gatsby

**Author:** [[F. Scott Fitzgerald]]

### Chapter 1

> In my younger and more vulnerable years...
```

## Installation

### From GitHub Release

1. Go to the [Releases](https://github.com/davidlbowman/kavita-to-obsidian/releases) page
2. Download `main.js` and `manifest.json` from the latest release
3. In your vault, create the folder `.obsidian/plugins/kavita-to-obsidian/`
4. Copy both downloaded files into that folder
5. Restart Obsidian
6. Go to Settings → Community Plugins and enable "Kavita to Obsidian"

### From Community Plugins (Coming Soon)

Once approved, you'll be able to install directly from Obsidian's community plugins browser.

## Setup

### 1. Get Your Kavita API Key

1. Open Kavita and log in
2. Click your profile icon → **User Settings**
3. Go to **3rd Party Clients**
4. Copy your API key (or generate one if you don't have one)

### 2. Configure the Plugin

1. In Obsidian, go to Settings → **Kavita to Obsidian**
2. Enter your Kavita server URL (e.g., `http://localhost:5000` or `https://kavita.example.com`)
3. Paste your API key
4. Adjust other settings as desired

## Settings

| Setting | What it does | Default |
|---------|--------------|---------|
| **Kavita URL** | Your Kavita server address | - |
| **API Key** | Your Kavita API key for authentication | - |
| **Export Mode** | Choose between "Single file" or "Hierarchical folders" | Hierarchical folders |
| **Output Path** | Where to save annotations (single file mode only) | `kavita-annotations.md` |
| **Root Folder** | Root folder for book files (hierarchical mode only) | `Kavita Annotations` |
| **Delete Orphaned Files** | Remove files when annotations are deleted | Yes |
| **Include Comments** | Include your personal notes with highlights | Yes |
| **Include Spoilers** | Include highlights marked as spoilers | No |
| **Include Tags** | Generate Obsidian tags from genres | Yes |
| **Tag Prefix** | Prefix for generated tags (empty for no prefix) | (empty) |
| **Include Wikilinks** | Create links to author/series notes | Yes |

## How to Use

### Sync Your Annotations

**Option 1:** Click the book icon in the left sidebar

**Option 2:** Press `Ctrl/Cmd + P` to open the command palette, then search for "Sync Kavita Annotations"

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
**Author:** [[F. Scott Fitzgerald]]  ← Links to your author note if it exists
```

## Troubleshooting

### "Connection failed" or "Network error"

- Make sure your Kavita URL is correct and accessible
- Check that Kavita is running
- If using HTTPS, ensure your certificate is valid

### "Authentication failed"

- Double-check your API key in Kavita's 3rd Party Clients settings
- Try generating a new API key

### Annotations not appearing

- Make sure you have highlights/annotations in Kavita
- Check that "Include Spoilers" is enabled if your annotations are marked as spoilers

## Questions or Issues?

- [Report a bug](https://github.com/davidlbowman/kavita-to-obsidian/issues/new?template=bug_report.md)
- [Request a feature](https://github.com/davidlbowman/kavita-to-obsidian/issues/new?template=feature_request.md)

## Contributing

Want to help improve the plugin? See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
