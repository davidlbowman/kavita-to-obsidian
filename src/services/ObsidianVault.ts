/**
 * Vault file operations as an Effect service.
 *
 * @module
 */
import { Context, Effect, Layer, Option, Predicate } from "effect";
import { TFile, TFolder } from "obsidian";
import { ObsidianFolderError, ObsidianWriteError } from "../errors.js";
import { ADDED_KEY, MANAGED_NOTE_KEY } from "../formatters/bookNote.js";
import type { BookNoteRef } from "../schemas.js";
import { ObsidianApp } from "./ObsidianApp.js";

/**
 * What a write did to the vault.
 *
 * @since 2.0.0
 * @category Vault
 */
export type WriteOutcome = "created" | "updated" | "unchanged";

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
		bookNotes(root: string): Effect.Effect<ReadonlyArray<BookNoteRef>>;
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

			const bookNoteRef = (file: TFile): Array<BookNoteRef> => {
				const frontmatter = metadataCache.getFileCache(file)?.frontmatter;
				const id: unknown = frontmatter?.[MANAGED_NOTE_KEY];
				const added: unknown = frontmatter?.[ADDED_KEY];
				const title: unknown = frontmatter?.title;
				const url: unknown = frontmatter?.kavita_url;
				const chapterId = Predicate.isNumber(id)
					? id
					: Predicate.isString(id)
						? Number(id)
						: Number.NaN;
				return Number.isInteger(chapterId)
					? [
							{
								path: file.path,
								chapterId,
								added: Predicate.isString(added) ? added : undefined,
								title: Predicate.isString(title) ? title : undefined,
								url: Predicate.isString(url) ? url : undefined,
							},
						]
					: [];
			};

			const collectBookNotes = (folder: TFolder): Array<BookNoteRef> =>
				folder.children.flatMap((child) =>
					child instanceof TFolder
						? collectBookNotes(child)
						: child instanceof TFile && child.extension === "md"
							? bookNoteRef(child)
							: [],
				);

			const bookNotes = (root: string) =>
				Effect.sync(() => {
					const folder = vault.getAbstractFileByPath(root);
					return folder instanceof TFolder ? collectBookNotes(folder) : [];
				});

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
