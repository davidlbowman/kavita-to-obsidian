/**
 * Obsidian App context tag for dependency injection.
 *
 * @module
 */
import { ServiceMap } from "effect";
import type { App } from "obsidian";

/**
 * Context tag for the Obsidian App instance.
 *
 * This is provided by the plugin at runtime and gives access to the vault.
 *
 * @since 0.0.1
 * @category Context
 */
export class ObsidianApp extends ServiceMap.Service<ObsidianApp, App>()(
	"ObsidianApp",
) {}
