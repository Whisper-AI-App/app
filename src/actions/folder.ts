import { v4 as uuidv4 } from "uuid";
import { mainStore } from "../stores/main/main-store";

/**
 * Creates a new folder with the given name.
 * @param name - The display name for the folder
 * @returns The ID of the newly created folder
 */
export function createFolder(name: string): string {
	const id = uuidv4();

	mainStore.setRow("folders", id, {
		id,
		name,
		createdAt: new Date().toISOString(),
	});

	return id;
}

/**
 * Renames an existing folder.
 * @param folderId - The ID of the folder to rename
 * @param name - The new name for the folder
 */
export function renameFolder(folderId: string, name: string): void {
	const existingFolder = mainStore.getRow("folders", folderId);
	if (existingFolder) {
		mainStore.setRow("folders", folderId, {
			...existingFolder,
			name,
		});
	}
}

/**
 * Deletes a folder. All chats in the folder become unfiled (folderId = "").
 * @param folderId - The ID of the folder to delete
 */
export function deleteFolder(folderId: string): void {
	// First, unfile all chats in this folder
	const chatIds = mainStore.getRowIds("chats");
	chatIds.forEach((chatId) => {
		const chat = mainStore.getRow("chats", chatId);
		if (chat?.folderId === folderId) {
			mainStore.setRow("chats", chatId, {
				...chat,
				folderId: "",
			});
		}
	});

	// Then delete the folder
	mainStore.delRow("folders", folderId);
}
