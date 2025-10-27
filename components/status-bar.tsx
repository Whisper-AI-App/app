import { StatusBar as StatusBarExpo } from "expo-status-bar";
import { useColorScheme } from "react-native";

export function StatusBar() {
	const color = useColorScheme();

	return (
		<StatusBarExpo
			style={color ? (color === "light" ? "dark" : "light") : "auto"}
		/>
	);
}
