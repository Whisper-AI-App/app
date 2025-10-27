import Chat from "@/components/chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SearchBar } from "@/components/ui/searchbar";
import { View } from "@/components/ui/view";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Dashboard() {
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
				}}
			>
				<SearchBar
					placeholder="Search for anything..."
					onSearch={(query) => console.log("Searching for:", query)}
					loading={false}
					containerStyle={{ flex: 1 }}
				/>

				<Avatar>
					<AvatarFallback>AB</AvatarFallback>
				</Avatar>
			</View>

			<View style={{ flex: 1 }}></View>

			<View style={{ paddingHorizontal: 16 }}>
				<Chat />
			</View>
		</SafeAreaView>
	);
}
