import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import {
	BookOpen,
	Calculator,
	Code,
	Coffee,
	Lightbulb,
	List,
	Mail,
	MessageCircle,
	Pencil,
	Sparkles,
	TextQuote,
	Zap,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, TouchableOpacity } from "react-native";
import { Card } from "./ui/card";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface SuggestionCardsProps {
	onSuggestionPress: (text: string) => void;
}

const suggestions = [
	{
		id: "explain",
		icon: Lightbulb,
		title: "Explain a topic",
		description: "Learn about any subject",
		prompt: "Explain ",
	},
	{
		id: "write",
		icon: Pencil,
		title: "Write a message",
		description: "Draft text for any purpose",
		prompt: "Write a ",
	},
	{
		id: "brainstorm",
		icon: Sparkles,
		title: "Brainstorm ideas",
		description: "Generate creative thoughts",
		prompt: "Help me brainstorm ",
	},
	{
		id: "answer",
		icon: MessageCircle,
		title: "Answer a question",
		description: "Get help with any query",
		prompt: "Can you help me with ",
	},
	{
		id: "summarize",
		icon: TextQuote,
		title: "Summarize text",
		description: "Make content concise",
		prompt: "Summarize ",
	},
	{
		id: "steps",
		icon: List,
		title: "Create a plan",
		description: "Break down a task",
		prompt: "Create a step-by-step plan for ",
	},
	{
		id: "code",
		icon: Code,
		title: "Write code",
		description: "Get programming help",
		prompt: "Write code to ",
	},
	{
		id: "improve",
		icon: Zap,
		title: "Improve writing",
		description: "Enhance your text",
		prompt: "Improve this text: ",
	},
	{
		id: "email",
		icon: Mail,
		title: "Draft an email",
		description: "Compose a message",
		prompt: "Draft an email about ",
	},
	{
		id: "learn",
		icon: BookOpen,
		title: "Learn something",
		description: "Understand a concept",
		prompt: "Teach me about ",
	},
	{
		id: "calculate",
		icon: Calculator,
		title: "Solve a problem",
		description: "Work through logic",
		prompt: "Help me solve ",
	},
	{
		id: "casual",
		icon: Coffee,
		title: "Chat casually",
		description: "Have a conversation",
		prompt: "Let's talk about ",
	},
];

export function SuggestionCards({ onSuggestionPress }: SuggestionCardsProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const [currentSet, setCurrentSet] = useState(0);
	const fadeAnim = useRef(new Animated.Value(1)).current;

	// Split suggestions into sets of 4
	const suggestionSets = [];
	for (let i = 0; i < suggestions.length; i += 4) {
		suggestionSets.push(suggestions.slice(i, i + 4));
	}

	useEffect(() => {
		const interval = setInterval(() => {
			// Fade out
			Animated.timing(fadeAnim, {
				toValue: 0,
				duration: 400,
				useNativeDriver: true,
			}).start(() => {
				// Change set
				setCurrentSet((prev) => (prev + 1) % suggestionSets.length);

				// Fade in
				Animated.timing(fadeAnim, {
					toValue: 1,
					duration: 600,
					useNativeDriver: true,
				}).start();
			});
		}, 12000); // 12 second pause

		return () => clearInterval(interval);
	}, [suggestionSets.length]);

	const currentSuggestions = suggestionSets[currentSet] || [];

	return (
		<Animated.View
			style={{
				paddingHorizontal: 16,
				paddingTop: 64,
				gap: 12,
				opacity: fadeAnim,
			}}
		>
			<View style={{ flexDirection: "row", gap: 12 }}>
				{currentSuggestions.slice(0, 2).map((suggestion) => (
					<TouchableOpacity
						key={suggestion.id}
						style={{ flex: 1 }}
						onPress={() => onSuggestionPress(suggestion.prompt)}
						activeOpacity={0.7}
					>
						<Card style={{ padding: 14, shadowOpacity: 0 }}>
							<View style={{ marginBottom: 8 }}>
								<suggestion.icon size={20} color={theme.textMuted} />
							</View>
							<Text
								variant="caption"
								style={{
									fontWeight: "600",
									marginBottom: 4,
									color: theme.textMuted,
								}}
							>
								{suggestion.title}
							</Text>
							<Text
								variant="caption"
								style={{ fontSize: 11, color: theme.textMuted }}
							>
								{suggestion.description}
							</Text>
						</Card>
					</TouchableOpacity>
				))}
			</View>
			<View style={{ flexDirection: "row", gap: 12 }}>
				{currentSuggestions.slice(2, 4).map((suggestion) => (
					<TouchableOpacity
						key={suggestion.id}
						style={{ flex: 1 }}
						onPress={() => onSuggestionPress(suggestion.prompt)}
						activeOpacity={0.7}
					>
						<Card style={{ padding: 14, shadowOpacity: 0 }}>
							<View style={{ marginBottom: 8 }}>
								<suggestion.icon size={20} color={theme.textMuted} />
							</View>
							<Text
								variant="caption"
								style={{
									fontWeight: "600",
									marginBottom: 4,
									color: theme.textMuted,
								}}
							>
								{suggestion.title}
							</Text>
							<Text
								variant="caption"
								style={{ fontSize: 11, color: theme.textMuted }}
							>
								{suggestion.description}
							</Text>
						</Card>
					</TouchableOpacity>
				))}
			</View>
		</Animated.View>
	);
}
