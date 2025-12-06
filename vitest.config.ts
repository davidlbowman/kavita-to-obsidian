import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		deps: {
			interopDefault: true,
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				"src/__mocks__/**",
				"src/main.ts",
				"src/index.ts",
				"src/errors.ts",
				"src/schemas.ts",
				"src/services/ObsidianApp.ts",
				"src/services/KavitaAuthClient.ts",
			],
			thresholds: {
				lines: 80,
				branches: 60,
				functions: 70,
				statements: 80,
			},
		},
	},
	resolve: {
		alias: {
			obsidian: new URL("./src/__mocks__/obsidian.ts", import.meta.url)
				.pathname,
		},
	},
});
