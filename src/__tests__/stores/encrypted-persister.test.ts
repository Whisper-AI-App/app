import { createStore } from "tinybase";

jest.mock("expo-crypto");
jest.mock("expo-file-system", () => {
	const files = new Map<string, string | Uint8Array>();

	class MockFile {
		uri: string;
		constructor(...args: unknown[]) {
			if (args.length === 2) {
				// new File(directory, name)
				const dir = args[0] as { uri: string };
				this.uri = `${dir.uri}/${args[1]}`;
			} else {
				this.uri = args[0] as string;
			}
		}
		get exists() {
			return files.has(this.uri);
		}
		async text() {
			const data = files.get(this.uri);
			if (data === undefined) throw new Error("File not found");
			return typeof data === "string" ? data : new TextDecoder().decode(data);
		}
		async bytes() {
			const data = files.get(this.uri);
			if (data === undefined) throw new Error("File not found");
			return typeof data === "string" ? new TextEncoder().encode(data) : data;
		}
		async write(content: string | Uint8Array) {
			files.set(this.uri, content);
		}
		info() {
			return { exists: files.has(this.uri), modificationTime: Date.now() };
		}
	}

	return {
		File: MockFile,
		Directory: class {
			uri: string;
			constructor(path: string) {
				this.uri = path;
			}
		},
		Paths: { document: "/mock/document", cache: "/mock/cache" },
		__files: files,
	};
});

// Access mock file system for assertions
const mockFS = jest.requireMock("expo-file-system") as {
	__files: Map<string, string | Uint8Array>;
};

import { createExpoFileSystemPersister } from "@/src/stores/main/encrypted-persister";

const TEST_FILE_PATH = "/mock/document/whisper.json";
const TEST_KEY_HEX = "a".repeat(64);

beforeEach(() => {
	mockFS.__files.clear();
	jest.clearAllMocks();
});

describe("createExpoFileSystemPersister", () => {
	it("encrypts data on save (output is not valid JSON)", async () => {
		const store = createStore();
		store.setTables({ chats: { c1: { id: "c1", name: "Test" } } });

		const persister = createExpoFileSystemPersister(
			store,
			TEST_FILE_PATH,
			TEST_KEY_HEX,
		);

		await persister.save();

		// Read raw file content
		const raw = mockFS.__files.get(TEST_FILE_PATH);
		expect(raw).toBeDefined();

		// The file should NOT be valid JSON (it's encrypted)
		if (typeof raw === "string") {
			expect(() => JSON.parse(raw)).toThrow();
		}
		// If it's bytes, it shouldn't be parseable as JSON either
		if (raw instanceof Uint8Array) {
			const text = new TextDecoder().decode(raw);
			expect(() => JSON.parse(text)).toThrow();
		}
	});

	it("decrypts data on load (round-trip)", async () => {
		const store = createStore();
		store.setTables({ chats: { c1: { id: "c1", name: "Test" } } });
		store.setValues({ version: "4" });

		const persister = createExpoFileSystemPersister(
			store,
			TEST_FILE_PATH,
			TEST_KEY_HEX,
		);

		await persister.save();

		// Create a new store and load from the encrypted file
		const store2 = createStore();
		const persister2 = createExpoFileSystemPersister(
			store2,
			TEST_FILE_PATH,
			TEST_KEY_HEX,
		);

		await persister2.load();

		expect(store2.getTable("chats")).toEqual({
			c1: { id: "c1", name: "Test" },
		});
		expect(store2.getValue("version")).toBe("4");
	});

	it("falls back to plain JSON for unencrypted files", async () => {
		// Write a plain JSON file (simulating pre-migration state)
		const plainContent = JSON.stringify([
			{ chats: { c1: { id: "c1", name: "OldChat" } } },
			{ version: "3" },
		]);
		mockFS.__files.set(TEST_FILE_PATH, plainContent);

		const store = createStore();
		const persister = createExpoFileSystemPersister(
			store,
			TEST_FILE_PATH,
			TEST_KEY_HEX,
		);

		await persister.load();

		expect(store.getTable("chats")).toEqual({
			c1: { id: "c1", name: "OldChat" },
		});
		expect(store.getValue("version")).toBe("3");
	});

	it("returns empty store for missing files", async () => {
		const store = createStore();
		const persister = createExpoFileSystemPersister(
			store,
			TEST_FILE_PATH,
			TEST_KEY_HEX,
		);

		await persister.load();

		expect(store.getTables()).toEqual({});
		expect(store.getValues()).toEqual({});
	});

	it("calls onIgnoredError on recoverable errors", async () => {
		const onError = jest.fn();

		// Write invalid data (not JSON and not encrypted)
		mockFS.__files.set(TEST_FILE_PATH, "not-valid-anything");

		const store = createStore();
		const persister = createExpoFileSystemPersister(
			store,
			TEST_FILE_PATH,
			TEST_KEY_HEX,
			onError,
		);

		await persister.load();

		expect(onError).toHaveBeenCalled();
	});

	it("provides getFilePath method", () => {
		const store = createStore();
		const persister = createExpoFileSystemPersister(
			store,
			TEST_FILE_PATH,
			TEST_KEY_HEX,
		);

		expect(persister.getFilePath()).toBe(TEST_FILE_PATH);
	});
});
