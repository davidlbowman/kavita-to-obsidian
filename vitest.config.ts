import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "json-summary"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				"src/__mocks__/**",
				"src/main.ts",
				"src/ui/SettingsTab.ts",
				"src/ui/SetupModal.ts",
				"src/ui/TemplatePage.ts",
				"src/ui/SyncController.ts",
			],
			thresholds: {
				lines: 95,
				branches: 90,
				functions: 95,
				statements: 95,
			},
		},
	},
	resolve: {
		alias: {
			obsidian: fileURLToPath(
				new URL("./src/__mocks__/obsidian.ts", import.meta.url),
			),
		},
	},
});
