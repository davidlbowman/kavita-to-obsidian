/**
 * Plugin configuration service with environment and settings layers.
 *
 * @module
 */
import { Config, Effect, Layer, Redacted } from "effect";
import type { PluginSettings } from "../schemas.js";

/**
 * Shape of plugin configuration values.
 *
 * @since 0.0.1
 * @category Config
 */
export interface PluginConfigShape {
	readonly kavitaUrl: URL;
	readonly kavitaApiKey: Redacted.Redacted<string>;
	readonly outputPath: string;
	readonly matchThreshold: number;
	readonly includeComments: boolean;
	readonly includeSpoilers: boolean;
	/** @since 0.0.2 */
	readonly includeTags: boolean;
	/** @since 0.0.2 */
	readonly tagPrefix: string;
	/** @since 0.0.2 */
	readonly includeWikilinks: boolean;
}

/**
 * Environment variable configuration for dev/test.
 *
 * @since 0.0.1
 * @category Config
 */
const EnvConfig = Config.all({
	kavitaUrl: Config.string("KAVITA_URL").pipe(
		Config.map((s) => new URL(s)),
		Config.withDefault(new URL("http://localhost:5000")),
	),
	kavitaApiKey: Config.redacted("KAVITA_API_KEY").pipe(
		Config.withDefault(Redacted.make("")),
	),
	outputPath: Config.string("OUTPUT_PATH").pipe(
		Config.withDefault("kavita-annotations.md"),
	),
	matchThreshold: Config.number("MATCH_THRESHOLD").pipe(
		Config.withDefault(0.7),
	),
	includeComments: Config.boolean("INCLUDE_COMMENTS").pipe(
		Config.withDefault(true),
	),
	includeSpoilers: Config.boolean("INCLUDE_SPOILERS").pipe(
		Config.withDefault(false),
	),
	includeTags: Config.boolean("INCLUDE_TAGS").pipe(Config.withDefault(true)),
	tagPrefix: Config.string("TAG_PREFIX").pipe(Config.withDefault("")),
	includeWikilinks: Config.boolean("INCLUDE_WIKILINKS").pipe(
		Config.withDefault(true),
	),
});

/**
 * Plugin configuration service.
 *
 * Provides configuration values from either Obsidian settings or environment variables.
 *
 * @since 0.0.1
 * @category Services
 */
export class PluginConfig extends Effect.Service<PluginConfig>()(
	"PluginConfig",
	{
		sync: (): PluginConfigShape => ({
			kavitaUrl: new URL("http://localhost:5000"),
			kavitaApiKey: Redacted.make(""),
			outputPath: "kavita-annotations.md",
			matchThreshold: 0.7,
			includeComments: true,
			includeSpoilers: false,
			includeTags: true,
			tagPrefix: "",
			includeWikilinks: true,
		}),
	},
) {
	/**
	 * Create config layer from Obsidian plugin settings.
	 *
	 * @since 0.0.1
	 * @category Layers
	 */
	static fromSettings(settings: typeof PluginSettings.Type) {
		return Layer.succeed(
			PluginConfig,
			new PluginConfig({
				kavitaUrl: new URL(settings.kavitaUrl),
				kavitaApiKey: Redacted.make(settings.kavitaApiKey),
				outputPath: settings.outputPath,
				matchThreshold: settings.matchThreshold,
				includeComments: settings.includeComments,
				includeSpoilers: settings.includeSpoilers,
				includeTags: settings.includeTags,
				tagPrefix: settings.tagPrefix,
				includeWikilinks: settings.includeWikilinks,
			}),
		);
	}

	/**
	 * Create config layer from environment variables.
	 *
	 * @since 0.0.1
	 * @category Layers
	 */
	static fromEnv = Layer.effect(
		PluginConfig,
		Effect.gen(function* () {
			const config = yield* EnvConfig;
			return new PluginConfig(config);
		}),
	);
}
