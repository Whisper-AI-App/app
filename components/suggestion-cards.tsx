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
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
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

// Helper to get random unique indices
function getRandomIndices(count: number, max: number): number[] {
	const indices = new Set<number>();
	while (indices.size < count) {
		indices.add(Math.floor(Math.random() * max));
	}
	return Array.from(indices);
}

export function SuggestionCards({ onSuggestionPress }: SuggestionCardsProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	// Track which suggestion indices are currently displayed (4 cards)
	const [displayedIndices, setDisplayedIndices] = useState<number[]>(() =>
		getRandomIndices(4, suggestions.length),
	);

	// Track fade animations for each card position (0-3)
	const fadeAnims = useRef([
		new Animated.Value(0.6),
		new Animated.Value(0.6),
		new Animated.Value(0.6),
		new Animated.Value(0.6),
	]).current;

	useEffect(() => {
		const interval = setInterval(() => {
			// Pick a random card position to replace (0-3)
			const cardPosition = Math.floor(Math.random() * 4);

			// Fade out the selected card
			Animated.timing(fadeAnims[cardPosition], {
				toValue: 0,
				duration: 600,
				useNativeDriver: true,
			}).start(() => {
				// Get the current suggestion at this position
				const currentIndex = displayedIndices[cardPosition];

				// Pick a new random suggestion that's not currently displayed
				// AND not the same as the one being replaced
				let newIndex: number;
				do {
					newIndex = Math.floor(Math.random() * suggestions.length);
				} while (
					displayedIndices.includes(newIndex) ||
					newIndex === currentIndex
				);

				// Update the displayed indices
				setDisplayedIndices((prev) => {
					const newIndices = [...prev];
					newIndices[cardPosition] = newIndex;
					return newIndices;
				});

				// Fade in the new card
				Animated.timing(fadeAnims[cardPosition], {
					toValue: 0.6,
					duration: 1000,
					useNativeDriver: true,
				}).start();
			});
		}, 8000); // Every 8 seconds

		return () => clearInterval(interval);
	}, [displayedIndices, fadeAnims]);

	// Get the actual suggestion objects for the current indices
	const currentSuggestions = displayedIndices.map((idx) => suggestions[idx]);

	// Render a single card with its own fade animation
	const renderCard = (
		suggestion: (typeof suggestions)[0],
		position: number,
	) => (
		<Animated.View
			key={`${position}-${suggestion.id}`}
			style={{ flex: 1, opacity: fadeAnims[position] }}
		>
			<TouchableOpacity
				onPress={() => onSuggestionPress(suggestion.prompt)}
				activeOpacity={0.7}
				style={{ height: "100%" }}
			>
				<Card
					style={{
						padding: 14,
						shadowOpacity: 0,
						height: "100%",
						justifyContent: "flex-start",
					}}
				>
					<View style={{ marginBottom: 8 }}>
						<suggestion.icon size={20} color={theme.textMuted} />
					</View>
					<Text
						variant="caption"
						style={{
							fontWeight: "600",
							marginBottom: 4,
							color: theme.textMuted,
							fontSize: 14,
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
		</Animated.View>
	);

	return (
		<View
			style={{
				paddingHorizontal: 16,
				paddingTop: 64,
				gap: 0,
			}}
		>
			<View style={{ flexDirection: "row", gap: 0, height: 100 }}>
				{renderCard(currentSuggestions[0], 0)}
				{renderCard(currentSuggestions[1], 1)}
			</View>
			<View style={{ flexDirection: "row", gap: 0, height: 100 }}>
				{renderCard(currentSuggestions[2], 2)}
				{renderCard(currentSuggestions[3], 3)}
			</View>
		</View>
	);
}
