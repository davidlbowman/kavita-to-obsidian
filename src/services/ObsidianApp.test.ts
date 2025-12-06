/**
 * Tests for ObsidianApp context tag.
 *
 * @module
 */

import { describe, it } from "@effect/vitest";
import { type Context, Effect, Layer } from "effect";
import { expect } from "vitest";
import { ObsidianApp } from "./ObsidianApp.js";

const mockApp = {
	vault: {
		adapter: {
			write: () => Promise.resolve(),
			read: () => Promise.resolve(""),
		},
	},
} as unknown as Context.Tag.Service<typeof ObsidianApp>;

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
