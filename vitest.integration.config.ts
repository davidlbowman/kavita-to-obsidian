import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test-integration/**/*.test.ts"],
		fileParallelism: false,
		testTimeout: 60_000,
		hookTimeout: 300_000,
	},
	resolve: {
		alias: {
			obsidian: fileURLToPath(
				new URL("./src/__mocks__/obsidian.ts", import.meta.url),
			),
		},
	},
});
