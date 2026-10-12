/**
 * Validated sync configuration derived from the stored plugin settings.
 *
 * @module
 */
import { Context, Effect, Layer, Schema } from "effect";
import { InvalidSettingsError } from "../errors.js";
import { KavitaUrl, PluginSettings } from "../schemas.js";

/**
 * Settings with the Kavita URL parsed and the auth key redacted.
 *
 * @since 2.0.0
 * @category Config
 */
export const SyncConfig = PluginSettings.mapFields((fields) => ({
	...fields,
	kavitaUrl: KavitaUrl,
	kavitaApiKey: Schema.RedactedFromValue(Schema.String),
}));

/**
 * @since 2.0.0
 * @category Config
 */
export type SyncConfig = typeof SyncConfig.Type;

/**
 * Parse and validate stored settings into a {@link SyncConfig}.
 *
 * @since 2.0.0
 * @category Config
 */
export const toSyncConfig = Effect.fnUntraced(function* (
	settings: PluginSettings,
) {
	if (settings.kavitaUrl.trim() === "") {
		return yield* new InvalidSettingsError({
			setting: "kavitaUrl",
			reason: "Set your Kavita server URL in the plugin settings.",
		});
	}
	if (settings.kavitaApiKey.trim() === "") {
		return yield* new InvalidSettingsError({
			setting: "kavitaApiKey",
			reason: "Set your Kavita auth key in the plugin settings.",
		});
	}
	return yield* Schema.decodeUnknownEffect(SyncConfig)({
		...settings,
		kavitaUrl: settings.kavitaUrl.trim(),
		kavitaApiKey: settings.kavitaApiKey.trim(),
	}).pipe(
		Effect.mapError(
			() =>
				new InvalidSettingsError({
					setting: "kavitaUrl",
					reason: `"${settings.kavitaUrl}" is not a valid http:// or https:// URL.`,
				}),
		),
	);
});

/**
 * The configuration for the current sync.
 *
 * @since 0.0.1
 * @category Services
 */
export class PluginConfig extends Context.Service<PluginConfig, SyncConfig>()(
	"kavita-to-obsidian/PluginConfig",
) {
	/**
	 * Build the config from stored settings, failing on invalid values.
	 *
	 * @since 0.0.1
	 * @category Layers
	 */
	static readonly fromSettings = (
		settings: PluginSettings,
	): Layer.Layer<PluginConfig, InvalidSettingsError> =>
		Layer.effect(PluginConfig, toSyncConfig(settings));
}
