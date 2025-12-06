/**
 * Obsidian vault adapter service for file operations.
 *
 * @module
 */
import { Effect, Option } from "effect";
import type { TFile } from "obsidian";
import { ObsidianFileNotFoundError, ObsidianWriteError } from "../errors.js";
import { ObsidianApp } from "./ObsidianApp.js";

/**
 * Obsidian adapter service.
 *
 * Provides methods for reading and writing files in the Obsidian vault.
 *
 * @since 0.0.1
 * @category Services
 */
export class ObsidianAdapter extends Effect.Service<ObsidianAdapter>()(
	"ObsidianAdapter",
	{
		effect: Effect.gen(function* () {
			const app = yield* ObsidianApp;
			const vault = app.vault;

			/**
			 * Write content to a file, creating it if it doesn't exist.
			 *
			 * @since 0.0.1
			 */
			const writeFile = (path: string, content: string) =>
				Effect.tryPromise({
					try: async () => {
						const existingFile = vault.getAbstractFileByPath(path);
						if (existingFile && "extension" in existingFile) {
							await vault.modify(existingFile as TFile, content);
						} else {
							await vault.create(path, content);
						}
					},
					catch: (e) => new ObsidianWriteError({ path, cause: e }),
				});

			/**
			 * Append content to an existing file.
			 *
			 * @since 0.0.1
			 */
			const appendToFile = (path: string, content: string) =>
				Effect.tryPromise({
					try: async () => {
						const file = vault.getAbstractFileByPath(path);
						if (file && "extension" in file) {
							await vault.append(file as TFile, content);
						} else {
							return Promise.reject(new Error("File does not exist"));
						}
					},
					catch: (e) => new ObsidianWriteError({ path, cause: e }),
				});

			/**
			 * Read content from a file.
			 *
			 * @since 0.0.1
			 */
			const readFile = (path: string) =>
				Effect.tryPromise({
					try: async () => {
						const file = vault.getAbstractFileByPath(path);
						if (file && "extension" in file) {
							return vault.read(file as TFile);
						}
						return Promise.reject(new Error("File not found"));
					},
					catch: () => new ObsidianFileNotFoundError({ path }),
				});

			/**
			 * Get a file by path, returning None if not found.
			 *
			 * @since 0.0.1
			 */
			const getFile = (path: string): Effect.Effect<Option.Option<TFile>> =>
				Effect.sync(() => {
					const file = vault.getAbstractFileByPath(path);
					if (file && "extension" in file) {
						return Option.some(file as TFile);
					}
					return Option.none();
				});

			/**
			 * List all markdown files in the vault.
			 *
			 * @since 0.0.1
			 */
			const listMarkdownFiles = Effect.sync(() => vault.getMarkdownFiles());

			return {
				writeFile,
				appendToFile,
				readFile,
				getFile,
				listMarkdownFiles,
			};
		}),
	},
) {}
