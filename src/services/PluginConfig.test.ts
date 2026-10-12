/**
 * Tests for turning stored settings into a validated sync config.
 *
 * @module
 */
import { assert, describe, it } from "@effect/vitest";
import { Effect, Redacted, Schema } from "effect";
import { DEFAULT_SETTINGS, ExportMode, PluginSettings } from "../schemas.js";
import { PluginConfig, toSyncConfig } from "./PluginConfig.js";

const settings = (overrides: Partial<PluginSettings>): PluginSettings => ({
	...DEFAULT_SETTINGS,
	kavitaUrl: "http://kavita.test:5000",
	kavitaApiKey: "key",
	...overrides,
});

describe("toSyncConfig", () => {
	it.effect.each<{
		readonly name: string;
		readonly overrides: Partial<PluginSettings>;
		readonly setting: "kavitaUrl" | "kavitaApiKey";
	}>([
		{ name: "empty URL", overrides: { kavitaUrl: "" }, setting: "kavitaUrl" },
		{
			name: "blank URL",
			overrides: { kavitaUrl: "   " },
			setting: "kavitaUrl",
		},
		{
			name: "empty key",
			overrides: { kavitaApiKey: "" },
			setting: "kavitaApiKey",
		},
		{
			name: "blank key",
			overrides: { kavitaApiKey: " \t" },
			setting: "kavitaApiKey",
		},
		{
			name: "non-http URL",
			overrides: { kavitaUrl: "ftp://kavita.test" },
			setting: "kavitaUrl",
		},
		{
			name: "unparseable URL",
			overrides: { kavitaUrl: "not a url" },
			setting: "kavitaUrl",
		},
	])("rejects $name", ({ overrides, setting }) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(toSyncConfig(settings(overrides)));
			assert.strictEqual(error._tag, "InvalidSettingsError");
			assert.strictEqual(error.setting, setting);
			assert.isNotEmpty(error.message);
		}),
	);

	it.effect("trims and parses the URL and redacts the key", () =>
		Effect.gen(function* () {
			const config = yield* toSyncConfig(
				settings({
					kavitaUrl: "  https://books.example.com/kavita  ",
					kavitaApiKey: "  secret  ",
				}),
			);
			assert.instanceOf(config.kavitaUrl, URL);
			assert.strictEqual(
				config.kavitaUrl.href,
				"https://books.example.com/kavita",
			);
			assert.isTrue(Redacted.isRedacted(config.kavitaApiKey));
			assert.strictEqual(Redacted.value(config.kavitaApiKey), "secret");
			assert.notInclude(JSON.stringify(config), "secret");
		}),
	);

	it.effect.prop(
		"keeps every non-connection setting as stored",
		[PluginSettings],
		([stored]) =>
			Effect.gen(function* () {
				const config = yield* toSyncConfig({
					...stored,
					kavitaUrl: "http://kavita.test",
					kavitaApiKey: "key",
				});
				const { kavitaUrl: _url, kavitaApiKey: _key, ...rest } = stored;
				const { kavitaUrl: _u, kavitaApiKey: _k, ...kept } = config;
				assert.deepStrictEqual(kept, rest);
			}),
	);

	it.effect("PluginConfig.fromSettings provides the parsed config", () =>
		Effect.gen(function* () {
			const config = yield* PluginConfig;
			assert.strictEqual(config.kavitaUrl.host, "kavita.test:5000");
			assert.isTrue(Schema.is(ExportMode)(config.exportMode));
		}).pipe(Effect.provide(PluginConfig.fromSettings(settings({})))),
	);

	it.effect("PluginConfig.fromSettings fails on invalid settings", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				Effect.gen(function* () {
					return yield* PluginConfig;
				}).pipe(
					Effect.provide(
						PluginConfig.fromSettings(settings({ kavitaUrl: "" })),
					),
				),
			);
			assert.strictEqual(error._tag, "InvalidSettingsError");
		}),
	);
});
