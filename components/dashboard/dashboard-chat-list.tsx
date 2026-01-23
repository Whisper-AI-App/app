import { ChatPreview } from "@/components/chat-preview";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Colors } from "@/theme/colors";
import { Linking, Pressable, useColorScheme } from "react-native";
import Animated, { type useAnimatedScrollHandler } from "react-native-reanimated";

export interface ChatPreviewData {
	chatId: string;
	name: string;
	text: string;
	date: Date;
}

interface DashboardChatListProps {
	chatPreviews: ChatPreviewData[];
	searchQuery: string;
	scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
	onChatPress: (chatId: string) => void;
	onStartConversation: () => void;
}

export function DashboardChatList({
	chatPreviews,
	searchQuery,
	scrollHandler,
	onChatPress,
	onStartConversation,
}: DashboardChatListProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

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
							paddingTop: index === 0 ? 148 : 16,
						}}
					>
						<ChatPreview
							chatId={preview.chatId}
							date={preview.date}
							name={preview.name}
							text={preview.text}
							onPress={() => onChatPress(preview.chatId)}
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
						<Button
							variant="secondary"
							size="lg"
							onPress={onStartConversation}
						>
							Start a conversation
						</Button>
					)}

					<View
						style={{
							display: "flex",
							flexDirection: "row",
							gap: 12,
							paddingVertical: 6,
							opacity: 0.5,
						}}
					>
						<Pressable
							onPress={() => Linking.openURL("https://usewhisper.org/news")}
						>
							<Text
								style={{
									display: "flex",
									flexDirection: "row",
									alignItems: "center",
									paddingBottom: 0.05,
									borderBottomColor: "rgba(150,150,150,0.25)",
									borderBottomWidth: 2,
									fontSize: 12,
									color: theme.textMuted,
								}}
							>
								Latest news
							</Text>
						</Pressable>
						<Pressable
							onPress={() =>
								Linking.openURL("https://usewhisper.org/chat-with-us")
							}
						>
							<Text
								style={{
									display: "flex",
									flexDirection: "row",
									alignItems: "center",
									paddingBottom: 0.05,
									borderBottomColor: "rgba(150,150,150,0.25)",
									borderBottomWidth: 2,
									fontSize: 12,
									color: theme.textMuted,
								}}
							>
								Report problem
							</Text>
						</Pressable>
					</View>
				</View>
			)}
		</Animated.ScrollView>
	);
}
