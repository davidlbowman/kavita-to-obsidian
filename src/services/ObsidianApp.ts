/**
 * The slice of the Obsidian `App` the plugin depends on.
 *
 * @module
 */
import { Context } from "effect";
import type { FileManager, MetadataCache, Vault } from "obsidian";

/**
 * Obsidian's `App`, narrowed to the vault, file manager, and metadata cache
 * methods the plugin calls.
 *
 * @since 0.0.1
 * @category Context
 */
export class ObsidianApp extends Context.Service<
	ObsidianApp,
	{
		readonly vault: Pick<
			Vault,
			| "getAbstractFileByPath"
			| "read"
			| "create"
			| "createBinary"
			| "modify"
			| "createFolder"
		>;
		readonly fileManager: Pick<FileManager, "trashFile">;
		readonly metadataCache: Pick<MetadataCache, "getFileCache">;
	}
>()("kavita-to-obsidian/ObsidianApp") {}
