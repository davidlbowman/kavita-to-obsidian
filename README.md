# Kavita Sync

Bring your reading highlights and notes from [Kavita](https://www.kavitareader.com/) into Obsidian, as beautiful, linked book notes.

- **One note per book.** Highlights are grouped by chapter in reading order and colored to match your Kavita highlight colors.
- **Back to the page.** Every highlight links straight to its exact spot in Kavita's reader, and each book links to the book.
- **Covers and a library.** Each note can show the book's cover, and an optional library view (an Obsidian base) shows all your books as cover cards.
- **Your notes stay yours.** Each note ends with a **My notes** heading. Anything you write under it, and any properties you add, are kept on every sync. Rename notes or reorganize them inside the folder freely.
- **Native and searchable.** Properties work with Bases and Dataview, and the settings are searchable.

## What a book note looks like

```markdown
---
title: The Great Gatsby
author:
  - "[[F. Scott Fitzgerald]]"
series: "[[The Great Gatsby]]"
series_index: 1
genres:
  - Fiction
cover: "[[Kavita Annotations/Covers/123.png]]"
highlights: 12
last_highlighted: 2026-10-12
kavita_url: https://kavita.example.com/library/1/series/42/book/123
kavita_series_id: 42
kavita_chapter_id: 123
tags:
  - kavita
  - series/the-great-gatsby
  - author/f-scott-fitzgerald
  - genre/fiction
---

![[Kavita Annotations/Covers/123.png|160]]

by [[F. Scott Fitzgerald]] · [Open in Kavita](https://kavita.example.com/library/1/series/42/book/123)

## Chapter 1

> [!kavita-yellow] [Page 3](https://kavita.example.com/library/1/series/42/book/123?annotation=987)
> In my younger and more vulnerable years my father gave me some advice…
>
> **Note:** The narrator sets up his own reliability here.

## My notes

Anything I write here is kept on every sync.
```

In Obsidian each highlight renders as a colored callout, and its page label opens that exact spot in Kavita. Spoilers, if you include them, appear collapsed. Everything above **My notes** is refreshed on each sync; write your own thoughts under it.

Prefer everything in one place? Choose **One note for everything** and all highlights go into a single note, grouped by series, book, and chapter.

## Requirements

- Kavita **0.8.8 or newer** (the first release with highlights). Every change is tested against live Kavita 0.8.8 and the latest release.
- Obsidian **1.13.2 or newer**, desktop or mobile.

## Getting started

1. Install **Kavita Sync** from Settings → Community plugins → Browse, and enable it.
2. The setup window opens. Enter your Kavita server URL and an auth key:
   - **Kavita 0.9 and newer:** in Kavita, open your user settings → **Manage auth keys** and create a key.
   - **Kavita 0.8:** user settings → **3rd party clients** → copy the API key.
3. Select **Connect**. You'll see who you're connected as and how many highlights are ready.
4. Choose a layout and folder, then **Sync now**.

You can reopen setup any time with the command **Kavita Sync: Connect to Kavita**.

### Install from a GitHub release

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/davidlbowman/kavita-to-obsidian/releases).
2. Put them in `.obsidian/plugins/kavita-sync/` inside your vault.
3. Restart Obsidian and enable **Kavita Sync** in Settings → Community plugins.

## Syncing

- **Sync now:** the book icon in the left ribbon, the command **Kavita Sync: Sync highlights**, the status bar item (desktop), or the **Sync now** button in settings.
- **Automatically:** turn on **Sync when Obsidian starts**, or choose an interval under **Sync automatically**. Automatic syncs are quiet unless new highlights arrive or something goes wrong.
- **From anywhere:** open `obsidian://kavita-sync` to start a sync, for example from a shortcut or script.

While a sync runs, a notice shows progress, then a summary such as _12 highlights from 4 books · 2 new_, with a link to open your notes. The status bar shows when you last synced.

Other commands:

- **Open this book in Kavita**: opens the current book note's book in Kavita.
- **Open library**: opens the library view, if you created one.

## Settings

| Setting                                 | What it does                                                                                    | Default                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------- |
| **Server URL**                          | Your Kavita address                                                                             |                         |
| **Auth key**                            | Your Kavita auth key, kept in Obsidian's secure storage rather than the vault                   |                         |
| **Layout**                              | One note per book, or one note for everything                                                   | One note per book       |
| **Folder**                              | Where book notes go, filed by series                                                            | `Kavita Annotations`    |
| **Note**                                | The note used by the one-note layout                                                            | `kavita-annotations.md` |
| **Download book covers**                | Show each cover in its note and the library view                                                | On                      |
| **Create a library view**               | Add a base that shows your books as cover cards (created once, never overwritten)               | Off                     |
| **Remove notes for deleted highlights** | Trash a book note once all its highlights are gone from Kavita (only notes this plugin created) | On                      |
| **Include your comments**               | Show the notes you wrote on highlights                                                          | On                      |
| **Include spoilers**                    | Show spoiler highlights, collapsed                                                              | Off                     |
| **Match highlight colors**              | Color highlights like Kavita, or use plain quotes                                               | On                      |
| **Highlight template**                  | Customize each highlight, with a live preview of your own highlights                            | Callout                 |
| **Link authors and series**             | Write authors and series as `[[links]]`                                                         | On                      |
| **Add tags** / **Genre tag prefix**     | Tag notes by series, author, and genre                                                          | On / `genre/`           |
| **Sync when Obsidian starts**           | Check for new highlights when the vault opens                                                   | Off                     |
| **Sync automatically**                  | Check for new highlights every 15 minutes to 3 hours                                            | Off                     |

### Highlight template

The template controls each highlight. Variables include `{{quote}}`, `{{selectedText}}`, `{{comment}}`, `{{commentQuote}}`, `{{callout}}`, `{{color}}`, `{{fold}}`, `{{location}}`, `{{link}}`, `{{pageNumber}}`, `{{chapterTitle}}`, `{{seriesName}}`, and `{{date}}`, plus `{{#if variable}}…{{/if}}` blocks. The template page in settings lists every variable and previews your most recent highlights as you type.

## Troubleshooting

Every error tells you what went wrong and links to the fix. See the [troubleshooting guide](./TROUBLESHOOTING.md) for details.

## Network & Privacy

This plugin connects only to your own Kavita server. All requests go through Obsidian's `requestUrl` to the server URL you configure:

| Request                             | Why                                                                  |
| ----------------------------------- | -------------------------------------------------------------------- |
| `POST /api/Plugin/authenticate`     | Exchange your auth key for a short-lived session token               |
| `GET /api/Account`                  | Find out which user the key belongs to, so only your highlights sync |
| `POST /api/Annotation/all-filtered` | Get your highlights                                                  |
| `GET /api/Series/volumes`           | Get book titles, authors, and genres                                 |
| `GET /api/Image/chapter-cover`      | Download covers (only when **Download book covers** is on)           |

- **Read-only:** the plugin never changes anything in Kavita.
- **Auth key:** stored in Obsidian's secret storage, not in your vault.
- **Open in Kavita:** the **Open this book in Kavita** command and the links in your notes open Kavita in your browser.
- **Vault access:** the plugin only reads and writes inside its own notes folder (and the single note, in one-note mode).
- **Only yours:** highlights other Kavita users share with you are never synced.
- **No telemetry:** no analytics or usage data, and nothing is sent anywhere else.

## Questions or issues?

- [Report a bug](https://github.com/davidlbowman/kavita-to-obsidian/issues/new?template=bug_report.md)
- [Request a feature](https://github.com/davidlbowman/kavita-to-obsidian/issues/new?template=feature_request.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, tests, and the release flow.

## License

MIT
