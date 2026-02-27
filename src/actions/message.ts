import { mainStore } from "../stores/main/main-store";

export function upsertMessage(
	id: string,
	chatId: string,
	contents: string,
	role: string,
	providerId?: string,
	modelId?: string,
	status?: string,
) {
	const existingMessage = mainStore.getRow("messages", id);

	mainStore.setRow("messages", id, {
		id,
		chatId,
		contents,
		role,
		createdAt: existingMessage?.createdAt || new Date().toISOString(),
		providerId: providerId || (existingMessage?.providerId as string) || "",
		modelId: modelId || (existingMessage?.modelId as string) || "",
		status: status || (existingMessage?.status as string) || "done",
	});
}

export function setMessageStatus(messageId: string, status: string) {
	mainStore.setCell("messages", messageId, "status", status);
}

export function deleteMessage(messageId: string) {
	mainStore.delRow("messages", messageId);
}
