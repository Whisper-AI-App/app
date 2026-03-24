import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import type { PerformanceTier } from "@/src/ai-providers/huggingface/types";
import { ChevronDown, Download, Pause, Play, X } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";

function formatFileSize(bytes: number): string {
	const gb = bytes / (1024 * 1024 * 1024);
	if (gb >= 1) return `${gb.toFixed(1)} GB`;
	const mb = bytes / (1024 * 1024);
	return `${mb.toFixed(0)} MB`;
}

function getBadgeColor(tier: PerformanceTier): string {
	switch (tier) {
		case "Very Well":
			return "#22c55e";
		case "Well":
			return "#3b82f6";
		case "Okay":
			return "#f59e0b";
		case "Poorly":
			return "#f97316";
		case "Badly":
			return "#ef4444";
	}
}

function getTierExplanation(tier: PerformanceTier): string {
	switch (tier) {
		case "Very Well":
			return "This model is well within your device's capabilities. Expect fast, smooth responses.";
		case "Well":
			return "This model should run comfortably on your device with good performance.";
		case "Okay":
			return "This model will work on your device but may be slower during long conversations.";
		case "Poorly":
			return "This model is close to your device's memory limit. Expect slower responses and possible interruptions.";
		case "Badly":
			return "This model may exceed your device's memory. It could crash or be unusable.";
	}
}

export type ModelCardAction =
	| "download"
	| "downloading"
	| "pause"
	| "resume"
	| "select"
	| "selected"
	| "delete"
	| "queued";

interface HFModelCardProps {
	name: string;
	fileSize: number;
	quantization: string;
	pipelineTag: string;
	performanceTier: PerformanceTier;
	action: ModelCardAction;
	progress?: number; // 0-1 for download progress
	onAction: () => void;
	onSecondaryAction?: () => void; // e.g., delete for downloaded models
	description?: string;
	isExpanded?: boolean;
	onToggleExpand?: () => void;
	architecture?: string;
	contextLength?: number;
	license?: string;
	parametersB?: number;
}

export function HFModelCard({
	name,
	fileSize,
	quantization,
	pipelineTag,
	performanceTier,
	action,
	progress,
	onAction,
	onSecondaryAction,
	description,
	isExpanded,
	onToggleExpand,
	architecture,
	contextLength,
	license,
	parametersB,
}: HFModelCardProps) {
	const borderColor = useColor("border");
	const mutedForeground = useColor("mutedForeground");
	const badgeColor = getBadgeColor(performanceTier);

	return (
		<View style={[styles.card, { borderColor }]}>
			<Pressable onPress={onToggleExpand} style={styles.header}>
				<View style={styles.titleRow}>
					<Text style={styles.name} numberOfLines={1}>
						{name}
					</Text>
					<View style={styles.titleRowRight}>
						<View
							style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}
						>
							<Text style={[styles.badgeText, { color: badgeColor }]}>
								{performanceTier}
							</Text>
						</View>
						{onToggleExpand ? (
							<View
								style={[
									styles.chevron,
									isExpanded ? styles.chevronExpanded : undefined,
								]}
							>
								<ChevronDown size={16} color={mutedForeground} />
							</View>
						) : null}
					</View>
				</View>

				<View style={styles.metaRow}>
					<Text style={[styles.meta, { color: mutedForeground }]}>
						{formatFileSize(fileSize)}
					</Text>
					{quantization ? (
						<Text style={[styles.meta, { color: mutedForeground }]}>
							{" "}
							· {quantization}
						</Text>
					) : null}
					<Text style={[styles.meta, { color: mutedForeground }]}>
						{" "}
						· {pipelineTag}
					</Text>
				</View>

				{description ? (
					<Text
						style={[styles.description, { color: mutedForeground }]}
						numberOfLines={isExpanded ? undefined : 2}
					>
						{description}
					</Text>
				) : null}
			</Pressable>

			{isExpanded ? (
				<View style={[styles.expandedSection, { borderColor }]}>
					{parametersB != null ? (
						<View style={styles.detailRow}>
							<Text style={[styles.detailLabel, { color: mutedForeground }]}>
								Parameters
							</Text>
							<Text style={styles.detailValue}>{parametersB} B parameters</Text>
						</View>
					) : null}
					{architecture ? (
						<View style={styles.detailRow}>
							<Text style={[styles.detailLabel, { color: mutedForeground }]}>
								Architecture
							</Text>
							<Text style={styles.detailValue}>{architecture}</Text>
						</View>
					) : null}
					{contextLength != null ? (
						<View style={styles.detailRow}>
							<Text style={[styles.detailLabel, { color: mutedForeground }]}>
								Context
							</Text>
							<Text style={styles.detailValue}>
								{contextLength.toLocaleString()} tokens
							</Text>
						</View>
					) : null}
					{license ? (
						<View style={styles.detailRow}>
							<Text style={[styles.detailLabel, { color: mutedForeground }]}>
								License
							</Text>
							<Text style={styles.detailValue}>{license}</Text>
						</View>
					) : null}
					<View
						style={[
							styles.tierExplanation,
							{ backgroundColor: `${badgeColor}10` },
						]}
					>
						<Text
							style={[styles.tierExplanationText, { color: mutedForeground }]}
						>
							{getTierExplanation(performanceTier)}
						</Text>
					</View>
				</View>
			) : null}

			{action === "downloading" && progress !== undefined ? (
				<View style={styles.progressRow}>
					<View style={styles.progressBarBg}>
						<View
							style={[
								styles.progressBarFill,
								{ width: `${Math.round(progress * 100)}%` },
							]}
						/>
					</View>
					<Text style={[styles.progressText, { color: mutedForeground }]}>
						{Math.round(progress * 100)}%
					</Text>
				</View>
			) : null}

			<View style={styles.actionRow}>
				{action === "downloading" ? (
					<Button size="sm" variant="outline" onPress={onAction}>
						<Pause size={14} color={mutedForeground} />
						<Text style={{ marginLeft: 4 }}>Pause</Text>
					</Button>
				) : action === "download" ? (
					<Button size="sm" onPress={onAction} icon={Download}>
						Download
					</Button>
				) : action === "resume" ? (
					<Button size="sm" onPress={onAction} icon={Play}>
						Resume
					</Button>
				) : action === "select" ? (
					<Button size="sm" onPress={onAction}>
						Select
					</Button>
				) : action === "selected" ? (
					<Button size="sm" variant="outline" disabled>
						Selected
					</Button>
				) : action === "delete" ? (
					<Button size="sm" variant="destructive" onPress={onAction}>
						Delete
					</Button>
				) : action === "queued" ? (
					<Button size="sm" variant="outline" onPress={onAction}>
						<X size={14} color={mutedForeground} />
						<Text style={{ marginLeft: 4 }}>Remove from Queue</Text>
					</Button>
				) : null}

				{onSecondaryAction && action !== "downloading" && action !== "queued" ? (
					<Button
						size="sm"
						variant="destructive"
						onPress={onSecondaryAction}
						style={{ marginLeft: 8 }}
					>
						Delete
					</Button>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderWidth: 1,
		borderRadius: 12,
		padding: 14,
		marginBottom: 10,
		gap: 10,
	},
	header: {
		gap: 4,
	},
	titleRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	titleRowRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	name: {
		fontSize: 15,
		fontWeight: "600",
		flex: 1,
		marginRight: 8,
	},
	badge: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 6,
	},
	badgeText: {
		fontSize: 11,
		fontWeight: "600",
	},
	chevron: {
		transform: [{ rotate: "0deg" }],
	},
	chevronExpanded: {
		transform: [{ rotate: "180deg" }],
	},
	metaRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	meta: {
		fontSize: 12,
	},
	description: {
		fontSize: 12,
		marginTop: 4,
		lineHeight: 16,
	},
	expandedSection: {
		borderTopWidth: 1,
		paddingTop: 10,
		gap: 8,
	},
	detailRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	detailLabel: {
		fontSize: 12,
	},
	detailValue: {
		fontSize: 12,
		fontWeight: "500",
	},
	tierExplanation: {
		padding: 10,
		borderRadius: 8,
		marginTop: 2,
	},
	tierExplanationText: {
		fontSize: 12,
		lineHeight: 16,
	},
	progressRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	progressBarBg: {
		flex: 1,
		height: 6,
		backgroundColor: "rgba(128,128,128,0.2)",
		borderRadius: 3,
		overflow: "hidden",
	},
	progressBarFill: {
		height: "100%",
		backgroundColor: "#3b82f6",
		borderRadius: 3,
	},
	progressText: {
		fontSize: 11,
		fontWeight: "600",
		width: 36,
		textAlign: "right",
	},
	actionRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		alignItems: "center",
	},
});
