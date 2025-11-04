import Chat from "@/components/chat";
import { ChatPreview } from "@/components/chat-preview";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/searchbar";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIChat } from "@/contexts/AIChatContext";
import { resetEverything } from "@/src/actions/reset";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useValue } from "tinybase/ui-react";

export default function Dashboard() {
	const router = useRouter();
	const version = useValue("version");

	const [settingsOpen, setSettingsOpen] = useState(false);

	const aiChat = useAIChat();

	// Check for completed model using useValue
	const downloadedAt = useValue("ai_chat_model_downloadedAt") as
		| string
		| undefined;
	const fileUri = useValue("ai_chat_model_fileUri") as string | undefined;

	// Check for completed model on mount and load it if available
	useEffect(() => {
		if (downloadedAt && fileUri && !aiChat.isLoaded) {
			// Model is downloaded but not loaded yet, load it
			console.log("[Dashboard] Loading model from:", fileUri);
			aiChat
				.loadModel({ ggufPath: fileUri })
				.then(() => {
					console.log("[Dashboard] Model loaded successfully");
				})
				.catch((error) => {
					console.error("[Dashboard] Failed to load model:", error);
				});
		}
	}, [downloadedAt, fileUri, aiChat]);

	return (
		<SafeAreaView style={{ flex: 1 }}>
			<View
				style={{
					width: "100%",
					justifyContent: "space-between",
					alignItems: "center",
					flexDirection: "row",
					padding: 16,
					gap: 16,
					borderBottomColor: "rgba(125,125,125,0.15)",
					borderBottomWidth: 1,
					marginBottom: 16,
				}}
			>
				<SearchBar
					placeholder="Search for anything..."
					onSearch={(query) => console.log("Searching for:", query)}
					loading={false}
					containerStyle={{ flex: 1 }}
				/>

				<Button
					onPress={() => setSettingsOpen(true)}
					variant="ghost"
					size="icon"
				>
					<Avatar>
						<AvatarFallback>{version}</AvatarFallback>
					</Avatar>
				</Button>
			</View>

			<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Whisper</SheetTitle>
						<SheetDescription>Settings</SheetDescription>
					</SheetHeader>
					<View style={{ paddingHorizontal: 16 }}>
						<Text>Delete Everything</Text>
						<Button
							variant="destructive"
							onPress={() => {
								resetEverything();
								router.replace("/");
							}}
						>
							Burn Everything
						</Button>
					</View>
				</SheetContent>
			</Sheet>

			<ScrollView
				style={{
					flex: 1,
					paddingHorizontal: 16,
				}}
			>
				{Array.from(Array(10).keys()).map((_w, index) => {
					return (
						<View key={index.toString()} style={{ paddingBottom: 12 }}>
							<ChatPreview
								date={new Date()}
								name="Learning about AI"
								text="There are many different AI archs, such as llama..."
							/>
						</View>
					);
				})}
			</ScrollView>

			<View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
				<Chat />
			</View>
		</SafeAreaView>
	);
}
