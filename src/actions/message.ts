import { mainStore } from "../stores/main/main-store";

export function upsertMessage(
	id: string,
	chatId: string,
	contents: string,
	role: string,
) {
	const existingMessage = mainStore.getRow("messages", id);

	mainStore.setRow("messages", id, {
		id,
		chatId,
		contents,
		role,
		createdAt: existingMessage?.createdAt || new Date().toISOString(),
	});
}

export function deleteMessage(messageId: string) {
	mainStore.delRow("messages", messageId);
}
