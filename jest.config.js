module.exports = {
	preset: "jest-expo",
	transformIgnorePatterns: [
		"node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|llama.rn|tinybase|whisper-llm-cards|@nanocollective/json-up))",
	],
	collectCoverageFrom: [
		"src/**/*.{ts,tsx}",
		"components/**/*.{ts,tsx}",
		"contexts/**/*.{ts,tsx}",
		"hooks/**/*.{ts,tsx}",
		"theme/**/*.{ts,tsx}",
		"!**/*.d.ts",
		"!**/node_modules/**",
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
	testMatch: ["**/__tests__/**/*.test.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1",
		"^@nanocollective/json-up$":
			"<rootDir>/node_modules/@nanocollective/json-up/dist/index.js",
	},
};
