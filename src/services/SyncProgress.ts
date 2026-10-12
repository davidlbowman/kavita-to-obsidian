/**
 * Progress messages emitted while a sync runs.
 *
 * @module
 */
import { Context, Effect } from "effect";

/**
 * Receives human-readable progress messages. Silent unless provided.
 *
 * @since 2.0.0
 * @category Services
 */
export const SyncProgress = Context.Reference<{
	readonly report: (message: string) => Effect.Effect<void>;
}>("kavita-to-obsidian/SyncProgress", {
	defaultValue: () => ({ report: () => Effect.void }),
});
