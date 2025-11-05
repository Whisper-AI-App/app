import { Card, CardContent } from "./ui/card";
import { Text } from "./ui/text";
import { View } from "./ui/view";
import { Pressable } from "react-native";

export function ChatPreview({
	chatId,
	name,
	text,
	date,
	onPress,
}: {
	chatId: string;
	name: string;
	text: string;
	date: Date;
	onPress?: () => void;
}) {
	return (
		<Pressable onPress={onPress}>
			<Card>
				<CardContent>
					<View
						style={{
							display: "flex",
							flexDirection: "row",
							justifyContent: "space-between",
							width: "100%",
							gap: 12,
						}}
					>
						<Text
							style={{
								fontSize: 16,
								fontWeight: "600",
								textTransform: "capitalize",
								flex: 1,
							}}
							numberOfLines={1}
							ellipsizeMode="tail"
						>
							{name}
						</Text>
						<Text style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>
							{date.toLocaleString(undefined, {
								timeStyle: "short",
							})}
						</Text>
					</View>
					<Text
						numberOfLines={1}
						style={{ opacity: 0.5, fontSize: 14, paddingTop: 4 }}
					>
						{text}
					</Text>
				</CardContent>
			</Card>
		</Pressable>
	);
}
