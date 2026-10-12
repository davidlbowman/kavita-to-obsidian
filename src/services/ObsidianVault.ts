/**
 * Vault file operations as an Effect service.
 *
 * @module
 */
import { Context, Effect, Layer, Option, Predicate } from "effect";
import { TFile, TFolder } from "obsidian";
import { ObsidianFolderError, ObsidianWriteError } from "../errors.js";
import { MANAGED_NOTE_KEY } from "../formatters/bookNote.js";
import { ObsidianApp } from "./ObsidianApp.js";

/**
 * What a write did to the vault.
 *
 * @since 2.0.0
 * @category Vault
 */
export type WriteOutcome = "created" | "updated" | "unchanged";

/**
 * A book note found in the vault by its Kavita chapter id.
 *
 * @since 2.0.0
 * @category Vault
 */
export interface BookNoteRef {
	readonly path: string;
	readonly chapterId: number;
}

/**
 * Vault adapter.
 *
 * @since 0.0.1
 * @category Services
 */
export class ObsidianVault extends Context.Service<
	ObsidianVault,
	{
		readText(path: string): Effect.Effect<Option.Option<string>>;
		writeText(
			path: string,
			content: string,
		): Effect.Effect<WriteOutcome, ObsidianWriteError>;
		writeBinaryIfMissing(
			path: string,
			data: ArrayBuffer,
		): Effect.Effect<WriteOutcome, ObsidianWriteError>;
		exists(path: string): Effect.Effect<boolean>;
		ensureFolder(path: string): Effect.Effect<void, ObsidianFolderError>;
		readonly bookNotes: Effect.Effect<ReadonlyArray<BookNoteRef>>;
		trashFile(path: string): Effect.Effect<void, ObsidianWriteError>;
		trashFolderIfEmpty(path: string): Effect.Effect<void, ObsidianFolderError>;
	}
>()("kavita-to-obsidian/ObsidianVault") {
	/**
	 * Requires an `ObsidianApp`.
	 *
	 * @since 0.0.1
	 * @category Layers
	 */
	static readonly layerNoDeps = Layer.effect(
		ObsidianVault,
		Effect.gen(function* () {
			const { vault, fileManager, metadataCache } = yield* ObsidianApp;

			const readText = (path: string) =>
				Effect.promise(async () => {
					const file = vault.getAbstractFileByPath(path);
					return file instanceof TFile
						? Option.some(await vault.read(file))
						: Option.none<string>();
				});

			const writeText = Effect.fn("ObsidianVault.writeText")(
				(path: string, content: string) =>
					Effect.tryPromise({
						try: async (): Promise<WriteOutcome> => {
							const existing = vault.getAbstractFileByPath(path);
							if (existing instanceof TFile) {
								if ((await vault.read(existing)) === content) {
									return "unchanged";
								}
								await vault.modify(existing, content);
								return "updated";
							}
							await vault.create(path, content);
							return "created";
						},
						catch: (cause) => new ObsidianWriteError({ path, cause }),
					}),
			);

			const writeBinaryIfMissing = Effect.fn(
				"ObsidianVault.writeBinaryIfMissing",
			)((path: string, data: ArrayBuffer) =>
				Effect.tryPromise({
					try: async (): Promise<WriteOutcome> => {
						if (vault.getAbstractFileByPath(path) !== null) {
							return "unchanged";
						}
						await vault.createBinary(path, data);
						return "created";
					},
					catch: (cause) => new ObsidianWriteError({ path, cause }),
				}),
			);

			const exists = (path: string) =>
				Effect.sync(() => vault.getAbstractFileByPath(path) !== null);

			const ensureFolder = Effect.fn("ObsidianVault.ensureFolder")(
				(path: string) =>
					Effect.tryPromise({
						try: async () => {
							if (!(vault.getAbstractFileByPath(path) instanceof TFolder)) {
								await vault.createFolder(path);
							}
						},
						catch: (cause) =>
							new ObsidianFolderError({ path, operation: "create", cause }),
					}),
			);

			const bookNotes = Effect.sync(() =>
				vault.getMarkdownFiles().flatMap((file): Array<BookNoteRef> => {
					const id: unknown =
						metadataCache.getFileCache(file)?.frontmatter?.[MANAGED_NOTE_KEY];
					const chapterId = Predicate.isNumber(id)
						? id
						: Predicate.isString(id)
							? Number(id)
							: Number.NaN;
					return Number.isInteger(chapterId)
						? [{ path: file.path, chapterId }]
						: [];
				}),
			);

			const trashFile = Effect.fn("ObsidianVault.trashFile")((path: string) =>
				Effect.tryPromise({
					try: async () => {
						const file = vault.getAbstractFileByPath(path);
						if (file instanceof TFile) {
							await fileManager.trashFile(file);
						}
					},
					catch: (cause) => new ObsidianWriteError({ path, cause }),
				}),
			);

			const trashFolderIfEmpty = Effect.fn("ObsidianVault.trashFolderIfEmpty")(
				(path: string) =>
					Effect.tryPromise({
						try: async () => {
							const folder = vault.getAbstractFileByPath(path);
							if (folder instanceof TFolder && folder.children.length === 0) {
								await fileManager.trashFile(folder);
							}
						},
						catch: (cause) =>
							new ObsidianFolderError({ path, operation: "delete", cause }),
					}),
			);

			return ObsidianVault.of({
				readText,
				writeText,
				writeBinaryIfMissing,
				exists,
				ensureFolder,
				bookNotes,
				trashFile,
				trashFolderIfEmpty,
			});
		}),
	);

	/**
	 * Provides its own `ObsidianApp` from the given app.
	 *
	 * @since 2.0.0
	 * @category Layers
	 */
	static readonly layer = (app: ObsidianApp["Service"]) =>
		ObsidianVault.layerNoDeps.pipe(
			Layer.provide(Layer.succeed(ObsidianApp, app)),
		);
}
