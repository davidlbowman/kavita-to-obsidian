# Kavita to Obsidian

Sync your reading highlights and notes from [Kavita](https://www.kavitareader.com/) to your Obsidian vault.

## What It Does

This plugin pulls all your annotations, highlights, and notes from Kavita and saves them as a beautifully formatted markdown file in your Obsidian vault. Your highlights become searchable, linkable, and integrated with the rest of your notes.

**Example output:**

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
**Tags:** #kavita/series/the-great-gatsby #kavita/author/f-scott-fitzgerald

### Chapter 1

> In my younger and more vulnerable years my father gave me some advice...

*Note:* This opening is iconic

Page 3

---

> So we beat on, boats against the current...

Page 180
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
| **Output Path** | Where to save your annotations file | `kavita-annotations.md` |
| **Include Comments** | Include your personal notes with highlights | Yes |
| **Include Spoilers** | Include highlights marked as spoilers | No |
| **Include Tags** | Generate Obsidian tags from your books | Yes |
| **Tag Prefix** | Prefix for generated tags | `kavita/` |
| **Include Wikilinks** | Create links to author/series notes | Yes |

## How to Use

### Sync Your Annotations

**Option 1:** Click the book icon in the left sidebar

**Option 2:** Press `Ctrl/Cmd + P` to open the command palette, then search for "Sync Kavita Annotations"

Your annotations will be saved to the file you specified in settings.

### Link to Your Annotations

The plugin creates headings for each book, so you can link directly to them from other notes:

```markdown
See my highlights from [[kavita-annotations#The Great Gatsby]]
```

If you have notes for authors or books, the wikilinks will automatically connect:

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
