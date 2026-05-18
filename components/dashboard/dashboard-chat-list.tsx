import { ChatPreview } from "@/components/chat-preview";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import Animated, {
	type useAnimatedScrollHandler,
} from "react-native-reanimated";

export interface ChatPreviewData {
	chatId: string;
	name: string;
	text: string;
	date: Date;
	folderId?: string;
}

interface DashboardChatListProps {
	chatPreviews: ChatPreviewData[];
	searchQuery: string;
	scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
	onChatPress: (chatId: string) => void;
	onStartConversation: () => void;
	onMoveToFolder?: (chatId: string) => void;
	onRename?: (chatId: string, currentName: string) => void;
}

export function DashboardChatList({
	chatPreviews,
	searchQuery,
	scrollHandler,
	onChatPress,
	onStartConversation,
	onMoveToFolder,
	onRename,
}: DashboardChatListProps) {
	return (
		<Animated.ScrollView
			style={{
				position: "relative",
				flex: 1,
				paddingHorizontal: 16,
			}}
			onScroll={scrollHandler}
			scrollEventThrottle={16}
		>
			{chatPreviews.length > 0 ? (
				chatPreviews.map((preview, index, array) => (
					<View
						key={preview.chatId}
						style={{
							paddingBottom: index >= array.length - 1 ? 160 : 0,
							paddingTop: index === 0 ? 128 : 16,
						}}
					>
						<ChatPreview
							chatId={preview.chatId}
							date={preview.date}
							name={preview.name}
							text={preview.text}
							onPress={() => onChatPress(preview.chatId)}
							onMoveToFolder={
								onMoveToFolder
									? () => onMoveToFolder(preview.chatId)
									: undefined
							}
							onRename={
								onRename
									? () => onRename(preview.chatId, preview.name)
									: undefined
							}
						/>
					</View>
				))
			) : (
				<View style={{ padding: 32, alignItems: "center", gap: 16 }}>
					<Text
						style={{
							opacity: 0.75,
							fontSize: searchQuery.trim() ? 16 : 14,
						}}
					>
						{searchQuery.trim() ? "No chats found" : "No chats yet"}
					</Text>
					{!searchQuery.trim() && (
						<Button variant="secondary" size="lg" onPress={onStartConversation}>
							Start a conversation
						</Button>
					)}
				</View>
			)}
		</Animated.ScrollView>
	);
}
