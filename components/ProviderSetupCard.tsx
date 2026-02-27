import type { AIProvider } from "@/src/ai-providers/types";
import type { AppIconVariant } from "@/src/data/app-icon-presets";
import { getAppIconPresetById } from "@/src/data/app-icon-presets";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import { Image } from "expo-image";
import { Switch, useColorScheme } from "react-native";
import { useCell, useValue } from "tinybase/ui-react";
import { Button } from "./ui/button";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface ProviderSetupCardProps {
	provider: AIProvider;
	onConfigure: (id: string) => void;
	onToggleEnabled: (id: string, enabled: boolean) => void;
}

export function ProviderSetupCard({
	provider,
	onConfigure,
	onToggleEnabled,
}: ProviderSetupCardProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const status = useCell("aiProviders", provider.id, "status") as
		| string
		| undefined;
	const appIconVariant = useValue("app_icon_variant") as
		| AppIconVariant
		| undefined;
	const appIconPreset = getAppIconPresetById(appIconVariant || "Default");

	const avatarSource =
		provider.id === "whisper-ai" ? appIconPreset?.image : provider.avatar;
	const isEnabled = status && status !== "disabled";

	const getActionLabel = () => {
		if (!status || status === "needs_setup") return "Setup";
		if (status === "error") return "Retry";
		if (status === "ready") return "Manage";
		if (status === "configuring") return "Continue Setup";
		return "Setup";
	};

	return (
		<View
			style={{
				backgroundColor: theme.card,
				borderRadius: BORDER_RADIUS / 2,
				padding: 16,
				marginBottom: 12,
				borderWidth: 1,
				borderColor: "rgba(125,125,125,0.15)",
			}}
		>
			{/* Top row: icon, name, type badge, switch */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					marginBottom: 8,
				}}
			>
				<Image
					source={avatarSource}
					style={{ width: 22, height: 22, borderRadius: 11 }}
				/>
				<Text
					style={{
						fontSize: 17,
						fontWeight: "600",
						marginLeft: 10,
						flex: 1,
					}}
				>
					{provider.name}
				</Text>

				{/* Type badge */}
				<View
					style={{
						paddingHorizontal: 8,
						paddingVertical: 2,
						borderRadius: 6,
						backgroundColor:
							provider.type === "local"
								? "rgba(34,197,94,0.15)"
								: "rgba(59,130,246,0.15)",
						marginRight: 12,
					}}
				>
					<Text
						style={{
							fontSize: 11,
							fontWeight: "600",
							color: provider.type === "local" ? theme.green : "#3b82f6",
						}}
					>
						{provider.type === "local" ? "Local" : "Cloud"}
					</Text>
				</View>

				<Switch
					value={!!isEnabled}
					onValueChange={(value) => onToggleEnabled(provider.id, value)}
					trackColor={{ false: theme.muted, true: theme.green }}
					thumbColor={theme.background}
					ios_backgroundColor={theme.muted}
				/>
			</View>

			{/* Description */}
			<Text
				style={{
					fontSize: 13,
					opacity: 0.6,
					marginBottom: 12,
					lineHeight: 18,
					maxWidth: 128 + 40,
				}}
			>
				{provider.description}
			</Text>

			{/* Status + Action row */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
				}}
			>
				{/* Status badge */}
				{status && status !== "ready" && (
					<StatusBadge status={status} theme={theme} />
				)}

				<View style={{ flex: 1 }} />

				{isEnabled && status !== "ready" && (
					<Button
						onPress={() => onConfigure(provider.id)}
						size="sm"
						variant="default"
					>
						{getActionLabel()}
					</Button>
				)}
			</View>
		</View>
	);
}

function StatusBadge({
	status,
	theme,
}: {
	status: string;
	theme: (typeof Colors)["light"];
}) {
	const colors: Record<string, string> = {
		ready: theme.green,
		configuring: "#f59e0b",
		needs_setup: "#6b7280",
		error: "#ef4444",
		disabled: "#9ca3af",
	};

	const labels: Record<string, string> = {
		ready: "Ready",
		configuring: "Configuring",
		needs_setup: "Not configured",
		error: "Error",
		disabled: "Disabled",
	};

	const color = colors[status] ?? "#6b7280";

	return (
		<View
			style={{
				paddingHorizontal: 8,
				paddingVertical: 3,
				borderRadius: 6,
				backgroundColor: `${color}20`,
			}}
		>
			<Text style={{ fontSize: 11, color, fontWeight: "500" }}>
				{labels[status] ?? status}
			</Text>
		</View>
	);
}
