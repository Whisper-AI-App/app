import Chat from "@/components/chat";
import { ChatPreview } from "@/components/chat-preview";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SearchBar } from "@/components/ui/searchbar";
import { View } from "@/components/ui/view";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useValue } from "tinybase/ui-react";

export default function Dashboard() {

	const version = useValue('version')

	console.log({version})

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

				<Avatar>
					<AvatarFallback>{version}</AvatarFallback>
				</Avatar>
			</View>

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
