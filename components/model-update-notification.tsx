import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { useRouter } from "expo-router";
import type { WhisperLLMCard } from "whisper-llm-cards";

interface ModelUpdateNotificationProps {
	isVisible: boolean;
	onClose: () => void;
	currentCard: WhisperLLMCard | null;
	newCard: WhisperLLMCard;
	currentVersion: string;
	newVersion: string;
	requiresDownload: boolean;
}

export function ModelUpdateNotification({
	isVisible,
	onClose,
	currentCard: _currentCard,
	newCard,
	currentVersion: _currentVersion,
	newVersion: _newVersion,
	requiresDownload,
}: ModelUpdateNotificationProps) {
	const router = useRouter();
	const mutedColor = useColor("textMuted");
	const accentColor = useColor("accent");

	const handleUpdate = () => {
		onClose();
		router.replace("/download");
	};

	return (
		<BottomSheet
			isVisible={isVisible}
			onClose={onClose}
			snapPoints={[0.6]}
			title={requiresDownload ? "AI Update Available" : "AI Updated!"}
		>
			<View style={{ paddingHorizontal: 24, paddingVertical: 16, gap: 24 }}>
				{/* Model Details */}
				<View
					style={{
						backgroundColor: accentColor,
						borderRadius: 12,
						padding: 16,
						gap: 8,
					}}
				>
					<Text
						style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}
					>
						{newCard.name}
					</Text>
					<View
						style={{
							flexDirection: "row",
							justifyContent: "center",
							gap: 8,
							flexWrap: "wrap",
						}}
					>
						<Text style={{ fontSize: 13, color: mutedColor }}>
							Size: {newCard.sizeGB.toFixed(1)} GB,
						</Text>
						<Text style={{ fontSize: 13, color: mutedColor }}>
							RAM: {newCard.ramGB.toFixed(1)} GB,
						</Text>
						<Text style={{ fontSize: 13, color: mutedColor }}>
							Params: {newCard.parametersB.toFixed(1)}B
						</Text>
					</View>
				</View>

				{/* Description */}
				{requiresDownload ? (
					<View style={{ gap: 8 }}>
						<Text
							style={{
								fontSize: 14,
								lineHeight: 20,
								color: mutedColor,
								textAlign: "center",
							}}
						>
							A new model version is available with improvements. Download it to
							get the latest features and performance enhancements.
						</Text>
					</View>
				) : (
					<View style={{ gap: 8 }}>
						<Text
							style={{
								fontSize: 14,
								lineHeight: 20,
								color: mutedColor,
								textAlign: "center",
							}}
						>
							Model information has been updated with the latest metadata. No
							download required.
						</Text>
					</View>
				)}

				{/* Actions */}
				<View style={{ gap: 12, marginTop: 8 }}>
					{requiresDownload ? (
						<>
							<Button onPress={handleUpdate} style={{ width: "100%" }}>
								Download Update
							</Button>
							<Button
								variant="outline"
								onPress={onClose}
								style={{ width: "100%" }}
							>
								Maybe Later
							</Button>
						</>
					) : (
						<Button onPress={onClose} style={{ width: "100%" }}>
							Got It
						</Button>
					)}
				</View>
			</View>
		</BottomSheet>
	);
}
