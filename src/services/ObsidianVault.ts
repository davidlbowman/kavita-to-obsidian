/**
 * Vault file operations as an Effect service.
 *
 * @module
 */
import { Context, Effect, Layer } from "effect";
import { TFile, TFolder } from "obsidian";
import { ObsidianFolderError, ObsidianWriteError } from "../errors.js";
import { MANAGED_NOTE_KEY } from "../formatters/bookFile.js";
import { ObsidianApp } from "./ObsidianApp.js";

/**
 * Whether a write created a new note or replaced an existing one.
 *
 * @since 2.0.0
 * @category Vault
 */
export type WriteOutcome = "created" | "updated";

const collectManagedNotes = (
	folder: TFolder,
	isManaged: (file: TFile) => boolean,
	into: Array<string>,
): Array<string> => {
	for (const child of folder.children) {
		if (child instanceof TFolder) {
			collectManagedNotes(child, isManaged, into);
		} else if (
			child instanceof TFile &&
			child.extension === "md" &&
			isManaged(child)
		) {
			into.push(child.path);
		}
	}
	return into;
};

/**
 * Vault adapter.
 *
 * @since 0.0.1
 * @category Services
 */
export class ObsidianVault extends Context.Service<
	ObsidianVault,
	{
		writeFile(
			path: string,
			content: string,
		): Effect.Effect<WriteOutcome, ObsidianWriteError>;
		ensureFolder(path: string): Effect.Effect<void, ObsidianFolderError>;
		managedNotes(root: string): Effect.Effect<ReadonlyArray<string>>;
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

			const writeFile = Effect.fn("ObsidianVault.writeFile")(
				(path: string, content: string) =>
					Effect.tryPromise({
						try: async (): Promise<WriteOutcome> => {
							const existing = vault.getAbstractFileByPath(path);
							if (existing instanceof TFile) {
								await vault.modify(existing, content);
								return "updated";
							}
							await vault.create(path, content);
							return "created";
						},
						catch: (cause) => new ObsidianWriteError({ path, cause }),
					}),
			);

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

			const managedNotes = (root: string) =>
				Effect.sync(() => {
					const folder = vault.getAbstractFileByPath(root);
					return folder instanceof TFolder
						? collectManagedNotes(
								folder,
								(file) =>
									metadataCache.getFileCache(file)?.frontmatter?.[
										MANAGED_NOTE_KEY
									] !== undefined,
								[],
							)
						: [];
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
				writeFile,
				ensureFolder,
				managedNotes,
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
