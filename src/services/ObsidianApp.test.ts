/**
 * Tests for ObsidianApp context tag.
 *
 * @module
 */

import { describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import type { App } from "obsidian";
import { expect } from "vitest";
import { ObsidianApp } from "./ObsidianApp.js";

const mockApp = {
	vault: {
		adapter: {
			write: () => Promise.resolve(),
			read: () => Promise.resolve(""),
		},
	},
} as unknown as App;

describe("ObsidianApp", () => {
	it("is a valid Context.Tag", () => {
		expect(ObsidianApp.key).toBe("ObsidianApp");
	});

	it.effect("can be provided via Layer", () =>
		Effect.gen(function* () {
			const app = yield* ObsidianApp;
			expect(app).toBe(mockApp);
		}).pipe(Effect.provide(Layer.succeed(ObsidianApp, mockApp))),
	);

	it.effect("can be used as a dependency in services", () =>
		Effect.gen(function* () {
			const app = yield* ObsidianApp;
			expect(app.vault).toBeDefined();
			expect(app.vault.adapter).toBeDefined();
		}).pipe(Effect.provide(Layer.succeed(ObsidianApp, mockApp))),
	);
});
