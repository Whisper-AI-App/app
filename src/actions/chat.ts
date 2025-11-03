import { store } from "../store";

export function upsertChat(id: string, name: string) {
    const existingChat = store.getRow('chats', id);

    store.setRow('chats', id, {
        id,
        name,
        createdAt: existingChat?.createdAt || new Date().toISOString(),
    });
}

export function deleteChat(chatId: string) {
    store.delRow('chats', chatId);
}
