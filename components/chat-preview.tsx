import { Card, CardContent } from "./ui/card";
import { Text } from "./ui/text";
import { View } from "./ui/view";

export function ChatPreview({
	name,
	text,
	date,
}: {
	name: string;
	text: string;
	date: Date;
}) {
	return (
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
						}}
						numberOfLines={1}
					>
						{name}
					</Text>
					<Text style={{ fontSize: 12, opacity: 0.5 }}>
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
	);
}
