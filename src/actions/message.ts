import { store } from "../stores/store";

export function upsertMessage(
	id: string,
	chatId: string,
	contents: string,
	role: string,
) {
	const existingMessage = store.getRow("messages", id);

	store.setRow("messages", id, {
		id,
		chatId,
		contents,
		role,
		createdAt: existingMessage?.createdAt || new Date().toISOString(),
	});
}

export function deleteMessage(messageId: string) {
	store.delRow("messages", messageId);
}
