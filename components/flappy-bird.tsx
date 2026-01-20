import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useGameSounds } from "@/hooks/useGameSounds";
import { mainStore } from "@/src/stores/main/main-store";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, useWindowDimensions } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";
import { useValue } from "tinybase/ui-react";

// Game constants
const BIRD_WIDTH = 40;
const BIRD_HEIGHT = 30;
const PIPE_WIDTH = 60;
const PIPE_GAP = 200;
const GRAVITY = 0.5;
const JUMP_FORCE = -9;
const PIPE_SPEED = 3;
const GROUND_HEIGHT = 80;

interface Pipe {
	id: number;
	x: number;
	gapY: number;
	passed: boolean;
}

interface FlappyBirdProps {
	onClose?: () => void;
	compact?: boolean;
}

export function FlappyBird({ onClose, compact = false }: FlappyBirdProps) {
	const { width: screenWidth, height: screenHeight } = useWindowDimensions();
	const primaryColor = useColor("primary");
	const backgroundColor = useColor("background");
	const cardColor = useColor("card");
	const mutedColor = useColor("textMuted");
	const secondaryColor = useColor("secondary");
	const tealColor = useColor("teal");
	const pinkColor = useColor("pink");
	const scheme = useColorScheme();
	const { playFlap, playScore, playHit } = useGameSounds();

	// Game dimensions
	const GAME_WIDTH = compact ? screenWidth - 48 : screenWidth - 32;
	const GAME_HEIGHT = compact ? 320 : screenHeight - 220;
	const BIRD_X = GAME_WIDTH * 0.2;

	// Game state
	const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">(
		"idle",
	);
	const [score, setScore] = useState(0);
	const [pipes, setPipes] = useState<Pipe[]>([]);

	// High score from TinyBase (persisted)
	const storedHighScore = useValue("flappy_bird_high_score") as number | undefined;
	const highScore = storedHighScore ?? 0;

	// Animation values - bird uses shared values for smooth animation
	const birdY = useSharedValue(GAME_HEIGHT / 2);
	const birdRotation = useSharedValue(0);

	// Refs for game loop state (avoid re-renders)
	const birdVelocityRef = useRef(0);
	const gameLoopRef = useRef<number | null>(null);
	const pipeIdCounter = useRef(0);
	const pipesRef = useRef<Pipe[]>([]);
	const scoreRef = useRef(0);

	const resetGame = useCallback(() => {
		birdY.value = GAME_HEIGHT / 2;
		birdVelocityRef.current = 0;
		birdRotation.value = 0;
		pipesRef.current = [];
		scoreRef.current = 0;
		setPipes([]);
		setScore(0);
		pipeIdCounter.current = 0;
	}, [GAME_HEIGHT, birdY, birdRotation]);

	const jump = useCallback(() => {
		if (gameState === "gameover") return;

		if (gameState === "idle") {
			setGameState("playing");
		}

		birdVelocityRef.current = JUMP_FORCE;
		birdRotation.value = withSpring(-25, { damping: 10, stiffness: 200 });

		playFlap();

		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
	}, [gameState, birdRotation, playFlap]);

	const restartGame = useCallback(() => {
		resetGame();
		setGameState("playing");
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}
	}, [resetGame]);

	const endGame = useCallback(() => {
		setGameState("gameover");
		// Save high score to TinyBase if new record
		if (scoreRef.current > highScore) {
			mainStore.setValue("flappy_bird_high_score", scoreRef.current);
		}
		playHit();
		if (process.env.EXPO_OS === "ios") {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
		}
	}, [playHit, highScore]);

	const addScore = useCallback(() => {
		scoreRef.current += 1;
		setScore(scoreRef.current);
		playScore();
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}
	}, [playScore]);

	// Game loop
	useEffect(() => {
		if (gameState !== "playing") {
			if (gameLoopRef.current) {
				cancelAnimationFrame(gameLoopRef.current);
				gameLoopRef.current = null;
			}
			return;
		}

		let frameCount = 0;
		let gameOver = false;

		const gameLoop = () => {
			if (gameOver) return;

			frameCount++;

			// Update bird physics
			birdVelocityRef.current += GRAVITY;
			const newY = birdY.value + birdVelocityRef.current;
			birdY.value = newY;

			// Update bird rotation
			const targetRotation = Math.min(
				Math.max(birdVelocityRef.current * 3, -30),
				90,
			);
			birdRotation.value = targetRotation;

			// Check ground/ceiling collision
			if (newY < 0 || newY > GAME_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT) {
				gameOver = true;
				endGame();
				return;
			}

			// Add new pipe every 90 frames
			if (frameCount % 90 === 0) {
				const minGapY = 80;
				const maxGapY = GAME_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 80;
				const gapY = Math.random() * (maxGapY - minGapY) + minGapY;

				pipesRef.current.push({
					id: pipeIdCounter.current++,
					x: GAME_WIDTH,
					gapY,
					passed: false,
				});
			}

			// Move pipes and check collisions
			for (let i = pipesRef.current.length - 1; i >= 0; i--) {
				const pipe = pipesRef.current[i];
				pipe.x -= PIPE_SPEED;

				// Check if bird passed pipe
				if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
					pipe.passed = true;
					addScore();
				}

				// Check collision
				const birdRight = BIRD_X + BIRD_WIDTH;
				const birdBottom = newY + BIRD_HEIGHT;
				const pipeRight = pipe.x + PIPE_WIDTH;

				if (birdRight > pipe.x && BIRD_X < pipeRight) {
					if (newY < pipe.gapY || birdBottom > pipe.gapY + PIPE_GAP) {
						gameOver = true;
						endGame();
						return;
					}
				}

				// Remove off-screen pipes
				if (pipe.x < -PIPE_WIDTH) {
					pipesRef.current.splice(i, 1);
				}
			}

			// Update pipe state for rendering
			setPipes([...pipesRef.current]);

			gameLoopRef.current = requestAnimationFrame(gameLoop);
		};

		gameLoopRef.current = requestAnimationFrame(gameLoop);

		return () => {
			if (gameLoopRef.current) {
				cancelAnimationFrame(gameLoopRef.current);
			}
		};
	}, [
		gameState,
		GAME_HEIGHT,
		GAME_WIDTH,
		BIRD_X,
		birdY,
		birdRotation,
		endGame,
		addScore,
	]);

	// Bird animated style
	const birdAnimatedStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateY: birdY.value },
			{ rotate: `${birdRotation.value}deg` },
		],
	}));

	return (
		<View
			style={{
				flex: compact ? undefined : 1,
				backgroundColor: compact ? "transparent" : backgroundColor,
				padding: compact ? 0 : 16,
			}}
		>
			{/* Header */}
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 12,
					paddingHorizontal: compact ? 0 : 8,
				}}
			>
				<View style={{ flexDirection: "row", gap: 16 }}>
					<Text style={{ fontSize: compact ? 14 : 16, color: mutedColor }}>
						Score:{" "}
						<Text style={{ fontWeight: "700", color: tealColor }}>{score}</Text>
					</Text>
					<Text style={{ fontSize: compact ? 14 : 16, color: mutedColor }}>
						Best:{" "}
						<Text style={{ fontWeight: "700", color: primaryColor }}>
							{highScore}
						</Text>
					</Text>
				</View>
				{onClose && (
					<Button variant="ghost" size="sm" onPress={onClose}>
						Close
					</Button>
				)}
			</View>

			{/* Game Area */}
			<Pressable onPress={jump}>
				<View
					style={{
						width: GAME_WIDTH,
						height: GAME_HEIGHT,
						backgroundColor: cardColor,
						borderRadius: 16,
						overflow: "hidden",
						position: "relative",
					}}
				>
					{/* Sky gradient background */}
					<View
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: GROUND_HEIGHT,
						}}
					>
						<Svg width="100%" height="100%" style={{ position: "absolute" }}>
							<Defs>
								<LinearGradient id="skyGradient" x1="0" y1="0" x2="0.3" y2="1">
									<Stop
										offset="0"
										stopColor="#ff9e37"
										stopOpacity={scheme === "dark" ? 0.15 : 0.12}
									/>
									<Stop
										offset="0.3"
										stopColor="#ff5b91"
										stopOpacity={scheme === "dark" ? 0.12 : 0.1}
									/>
									<Stop
										offset="0.6"
										stopColor="#69b7ff"
										stopOpacity={scheme === "dark" ? 0.1 : 0.08}
									/>
									<Stop offset="1" stopColor="transparent" stopOpacity={0} />
								</LinearGradient>
							</Defs>
							<Rect
								x="0"
								y="0"
								width="100%"
								height="100%"
								fill="url(#skyGradient)"
							/>
						</Svg>
					</View>

					{/* Pipes - simplified for performance */}
					{pipes.map((pipe) => (
						<View key={pipe.id}>
							{/* Top pipe */}
							<View
								style={{
									position: "absolute",
									left: pipe.x,
									top: 0,
									width: PIPE_WIDTH,
									height: pipe.gapY,
									backgroundColor: primaryColor,
									borderBottomLeftRadius: 8,
									borderBottomRightRadius: 8,
								}}
							/>
							{/* Top pipe cap */}
							<View
								style={{
									position: "absolute",
									left: pipe.x - 4,
									top: pipe.gapY - 24,
									width: PIPE_WIDTH + 8,
									height: 24,
									backgroundColor: primaryColor,
									borderRadius: 4,
								}}
							/>

							{/* Bottom pipe */}
							<View
								style={{
									position: "absolute",
									left: pipe.x,
									top: pipe.gapY + PIPE_GAP,
									width: PIPE_WIDTH,
									height: GAME_HEIGHT - GROUND_HEIGHT - pipe.gapY - PIPE_GAP,
									backgroundColor: primaryColor,
									borderTopLeftRadius: 8,
									borderTopRightRadius: 8,
								}}
							/>
							{/* Bottom pipe cap */}
							<View
								style={{
									position: "absolute",
									left: pipe.x - 4,
									top: pipe.gapY + PIPE_GAP,
									width: PIPE_WIDTH + 8,
									height: 24,
									backgroundColor: primaryColor,
									borderRadius: 4,
								}}
							/>
						</View>
					))}

					{/* Bird */}
					<Animated.View
						style={[
							{
								position: "absolute",
								left: BIRD_X,
								width: BIRD_WIDTH,
								height: BIRD_HEIGHT,
							},
							birdAnimatedStyle,
						]}
					>
						{/* Bird body */}
						<View
							style={{
								width: BIRD_WIDTH,
								height: BIRD_HEIGHT,
								backgroundColor: pinkColor,
								borderRadius: BIRD_HEIGHT / 2,
								justifyContent: "center",
								alignItems: "flex-end",
								paddingRight: 4,
							}}
						>
							{/* Eye */}
							<View
								style={{
									width: 10,
									height: 10,
									backgroundColor: "#fff",
									borderRadius: 5,
									position: "absolute",
									top: 6,
									right: 8,
								}}
							>
								<View
									style={{
										width: 5,
										height: 5,
										backgroundColor: primaryColor,
										borderRadius: 2.5,
										position: "absolute",
										top: 2,
										right: 1,
									}}
								/>
							</View>
							{/* Beak */}
							<View
								style={{
									width: 12,
									height: 8,
									backgroundColor: tealColor,
									borderRadius: 4,
									position: "absolute",
									right: -6,
									top: 12,
								}}
							/>
							{/* Wing */}
							<View
								style={{
									width: 16,
									height: 12,
									backgroundColor: pinkColor,
									borderRadius: 8,
									position: "absolute",
									left: 8,
									top: 10,
									opacity: 0.7,
									borderWidth: 2,
									borderColor: "rgba(255,255,255,0.3)",
								}}
							/>
						</View>
					</Animated.View>

					{/* Ground */}
					<View
						style={{
							position: "absolute",
							bottom: 0,
							left: 0,
							right: 0,
							height: GROUND_HEIGHT,
							backgroundColor: secondaryColor,
						}}
					>
						<View
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								height: 4,
								backgroundColor: mutedColor,
								opacity: 0.3,
							}}
						/>
					</View>

					{/* Idle overlay */}
					{gameState === "idle" && (
						<View
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								bottom: GROUND_HEIGHT,
								justifyContent: "center",
								alignItems: "center",
								backgroundColor: "rgba(0,0,0,0.4)",
							}}
						>
							<Text
								style={{
									fontSize: compact ? 24 : 32,
									fontWeight: "800",
									color: "#fff",
									marginBottom: 8,
								}}
							>
								Flappy Bird
							</Text>
							<Text
								style={{
									fontSize: compact ? 14 : 18,
									color: "#fff",
									opacity: 0.9,
								}}
							>
								Tap to start
							</Text>
						</View>
					)}

					{/* Game over overlay */}
					{gameState === "gameover" && (
						<View
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								right: 0,
								bottom: GROUND_HEIGHT,
								justifyContent: "center",
								alignItems: "center",
								backgroundColor: "rgba(0,0,0,0.8)",
							}}
						>
							<Text
								style={{
									fontSize: compact ? 24 : 32,
									fontWeight: "800",
									color: "#fff",
									marginBottom: 8,
								}}
							>
								Game Over
							</Text>
							<Text
								style={{
									fontSize: compact ? 18 : 24,
									fontWeight: "600",
									color: "#fff",
									marginBottom: 4,
								}}
							>
								Score: {score}
							</Text>
							{score === highScore && score > 0 && (
								<Text
									style={{
										fontSize: compact ? 14 : 16,
										color: tealColor,
										fontWeight: "600",
										marginBottom: 8,
									}}
								>
									New High Score!
								</Text>
							)}
							<Button
								onPress={restartGame}
								variant="default"
								size={compact ? "sm" : "default"}
								style={{ marginTop: 16 }}
							>
								Try Again
							</Button>
						</View>
					)}
				</View>
			</Pressable>

			{/* Instructions */}
			{!compact && (
				<Text
					style={{
						fontSize: 14,
						color: mutedColor,
						textAlign: "center",
						marginTop: 12,
					}}
				>
					Tap anywhere to flap!
				</Text>
			)}
		</View>
	);
}
