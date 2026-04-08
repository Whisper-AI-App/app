import { useColor } from "@/hooks/useColor";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface ToolStatusProps {
	toolName: string;
	args: Record<string, unknown>;
	isExecuting?: boolean;
}

/**
 * Inline tool execution status shown in the chat while a tool is running.
 */
export function ToolStatus({ toolName, args, isExecuting = true }: ToolStatusProps) {
	const borderColor = useColor("border");
	const bgColor = useColor("muted");
	const labelColor = useColor("mutedForeground");
	const textColor = useColor("foreground");

	const displayArgs = getDisplayArgs(toolName, args);

	return (
		<View style={[styles.container, { borderColor, backgroundColor: bgColor }]}>
			<View style={styles.header}>
				<Text style={[styles.icon, { color: labelColor }]}>
					{getToolIcon(toolName)}
				</Text>
				<Text style={[styles.toolName, { color: textColor }]}>
					{formatToolName(toolName)}
				</Text>
				{isExecuting && (
					<ActivityIndicator size="small" style={styles.spinner} />
				)}
				{!isExecuting && (
					<Text style={styles.checkmark}>
						{"✓"}
					</Text>
				)}
			</View>
			{displayArgs ? (
				<Text style={[styles.args, { color: labelColor }]} numberOfLines={2}>
					{displayArgs}
				</Text>
			) : null}
		</View>
	);
}

function getToolIcon(toolName: string): string {
	switch (toolName) {
		case "web_search":
			return "Search";
		case "fetch_url":
			return "Fetch";
		default:
			return "Tool";
	}
}

function formatToolName(name: string): string {
	switch (name) {
		case "web_search":
			return "Searching";
		case "fetch_url":
			return "Fetching page";
		default:
			return name;
	}
}

function getDisplayArgs(toolName: string, args: Record<string, unknown>): string | null {
	switch (toolName) {
		case "web_search":
			return args.query ? `"${String(args.query)}"` : null;
		case "fetch_url":
			return args.url ? String(args.url) : null;
		default: {
			const entries = Object.entries(args);
			if (entries.length === 0) return null;
			return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
		}
	}
}

const styles = StyleSheet.create({
	container: {
		borderWidth: 1,
		borderRadius: 8,
		padding: 10,
		marginVertical: 4,
		marginHorizontal: 8,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	icon: {
		fontSize: 13,
		fontWeight: "600",
	},
	toolName: {
		fontSize: 13,
		fontWeight: "600",
		flex: 1,
	},
	spinner: {
		marginLeft: 4,
	},
	checkmark: {
		fontSize: 14,
		color: "#22c55e",
		marginLeft: 4,
	},
	args: {
		fontSize: 12,
		marginTop: 4,
	},
});
