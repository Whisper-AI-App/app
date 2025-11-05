import { Share } from 'react-native';
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

    // Also delete all messages associated with this chat
    const messageIds = store.getRowIds('messages');
    messageIds.forEach((messageId) => {
        const message = store.getRow('messages', messageId);
        if (message?.chatId === chatId) {
            store.delRow('messages', messageId);
        }
    });
}

export function renameChat(chatId: string, newName: string) {
    const existingChat = store.getRow('chats', chatId);
    if (existingChat) {
        store.setRow('chats', chatId, {
            ...existingChat,
            name: newName,
        });
    }
}

export async function shareChat(chatId: string) {
    const chat = store.getRow('chats', chatId);
    if (!chat) {
        console.log('[shareChat] Chat not found:', chatId);
        return;
    }

    // Get all messages for this chat
    const messageIds = store.getRowIds('messages');
    const chatMessages = messageIds
        .map((id) => {
            const msg = store.getRow('messages', id);
            if (msg?.chatId !== chatId) return null;
            return {
                role: msg.role,
                contents: msg.contents,
                createdAt: msg.createdAt,
            };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a!.createdAt).getTime() - new Date(b!.createdAt).getTime());

    // Format chat as text
    let chatText = `Chat: ${chat.name}\n`;
    chatText += `Created: ${new Date(chat.createdAt).toLocaleString()}\n\n`;

    chatMessages.forEach((msg) => {
        if (msg) {
            const sender = msg.role === 'user' ? 'You' : 'AI';
            chatText += `${sender}: ${msg.contents}\n\n`;
        }
    });

    console.log('[shareChat] Attempting to share:', chatText.length, 'characters');

    try {
        const result = await Share.share({
            message: chatText,
            title: `Chat: ${chat.name}`,
        });

        console.log('[shareChat] Share result:', result);

        if (result.action === Share.sharedAction) {
            console.log('[shareChat] Successfully shared');
        } else if (result.action === Share.dismissedAction) {
            console.log('[shareChat] Share dismissed');
        }
    } catch (error) {
        console.error('[shareChat] Error sharing:', error);
        throw error;
    }
}
