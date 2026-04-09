// Jest setup file for @testing-library/react-native
// Add custom matchers and global test setup here

// Global mock for structured logger — prevents file system calls during tests
jest.mock("@/src/logger", () => {
	const noopLogger = {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
		flush: jest.fn().mockResolvedValue(undefined),
	};
	return {
		createLogger: jest.fn(() => noopLogger),
		getLogs: jest.fn().mockResolvedValue([]),
		clearLogs: jest.fn().mockResolvedValue(undefined),
		flushLogs: jest.fn().mockResolvedValue(undefined),
	};
});
