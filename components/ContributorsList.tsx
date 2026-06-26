import type React from "react";
import {
	FlatList,
	Image,
	Linking,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";

import contributorsData from "../assets/contributors.json";

interface ContributorsListProps {
	variant: "onboarding" | "settings";
}

export const ContributorsList: React.FC<ContributorsListProps> = ({ variant }) => {
	const openProfile = (url: string) => {
		if (url) {
			// biome-ignore lint/suspicious/noConsole: Needed for openURL catch logging
			Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
		}
	};

	if (variant === "onboarding") {
		return (
			<FlatList
				data={contributorsData}
				keyExtractor={(item) => item.login}
				numColumns={4}
				contentContainerStyle={styles.gridContainer}
				renderItem={({ item }) => (
					<TouchableOpacity
						style={styles.avatarWrapper}
						onPress={() => openProfile(item.html_url)}
					>
						<Image source={{ uri: item.avatar_url }} style={styles.gridAvatar} />
					</TouchableOpacity>
				)}
			/>
		);
	}

	return (
		<FlatList
			data={contributorsData}
			keyExtractor={(item) => item.login}
			contentContainerStyle={styles.listContainer}
			renderItem={({ item }) => (
				<TouchableOpacity
					style={styles.rowContainer}
					onPress={() => openProfile(item.html_url)}
				>
					<Image source={{ uri: item.avatar_url }} style={styles.listAvatar} />
					<Text style={styles.username}>@{item.login}</Text>
					{item.contributions && (
						<View style={styles.badge}>
							<Text style={styles.badgeText}>{item.contributions}</Text>
						</View>
					)}
				</TouchableOpacity>
			)}
		/>
	);
};

const styles = StyleSheet.create({
	gridContainer: {
		padding: 16,
		alignItems: "center",
	},
	avatarWrapper: {
		margin: 8,
	},
	gridAvatar: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: "#333",
	},
	listContainer: {
		paddingVertical: 8,
	},
	rowContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 0.5,
		borderBottomColor: "#333",
	},
	listAvatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#333",
		marginRight: 16,
	},
	username: {
		flex: 1,
		fontSize: 16,
		fontWeight: "500",
		color: "#fff",
	},
	badge: {
		backgroundColor: "#222",
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 10,
	},
	badgeText: {
		fontSize: 12,
		color: "#888",
	},
});