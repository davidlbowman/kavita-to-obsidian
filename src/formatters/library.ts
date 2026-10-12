/**
 * A Bases file that shows every synced book as a cover card, plus a table.
 *
 * @module
 */
import { MANAGED_NOTE_KEY } from "./bookNote.js";

/**
 * The `.base` file for the library view of synced books.
 *
 * @since 2.0.0
 * @category Library
 */
export const libraryBase = (rootFolder: string): string => `filters:
  and:
    - ${JSON.stringify(`file.inFolder(${JSON.stringify(rootFolder)})`)}
    - file.hasProperty("${MANAGED_NOTE_KEY}")
properties:
  file.name:
    displayName: Book
  note.author:
    displayName: Author
  note.series:
    displayName: Series
  note.highlights:
    displayName: Highlights
  note.last_highlighted:
    displayName: Last highlighted
views:
  - type: cards
    name: Library
    image: note.cover
    imageFit: contain
    imageAspectRatio: 1.5
    order:
      - file.name
      - note.author
      - note.highlights
    sort:
      - property: note.last_highlighted
        direction: DESC
  - type: table
    name: All books
    order:
      - file.name
      - note.author
      - note.series
      - note.series_index
      - note.highlights
      - note.last_highlighted
    groupBy:
      property: note.series
      direction: ASC
`;
