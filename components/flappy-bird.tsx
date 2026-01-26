import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useGameSounds } from "@/hooks/useGameSounds";
import { mainStore } from "@/src/stores/main/main-store";
import {
	Canvas,
	Group,
	LinearGradient,
	Path,
	RoundedRect,
	Skia,
	vec,
} from "@shopify/react-native-skia";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { Pressable, useWindowDimensions } from "react-native";
import {
	runOnJS,
	type SharedValue,
	useDerivedValue,
	useFrameCallback,
	useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useValue } from "tinybase/ui-react";

// Game constants
const BIRD_SIZE = 55;
const PIPE_WIDTH = 60;
const PIPE_GAP = 200;
// Physics tuned for 60fps baseline
const GRAVITY = 0.6;
const JUMP_FORCE = -10;
const PIPE_SPEED = 4;
const GROUND_HEIGHT = 80;
const MAX_PIPES = 4;
const TARGET_FPS = 60;

interface FlappyBirdProps {
	onClose?: () => void;
	compact?: boolean;
}

// Create the Whisper bird SVG path
const createBirdPath = (size: number) => {
	const scale = size / 24;
	const svgPathString = [
		"M 16,7 L 16.01,7",
		"M 3.4,18 L 12,18 A 8,8 0 0 0 20,10 L 20,7 A 4,4 0 0 0 12.72,4.7 L 2,20",
		"M 20,7 L 22,7.5 L 20,8",
		"M 10,18 L 10,21",
		"M 14,17.75 L 14,21",
		"M 7,18 A 6,6 0 0 0 10.84,7.39",
	].join(" ");

	const path = Skia.Path.MakeFromSVGString(svgPathString);
	if (!path) {
		const fallback = Skia.Path.Make();
		fallback.addCircle(size / 2, size / 2, size / 2 - 2);
		return fallback;
	}
	if (scale !== 1) {
		path.transform(Skia.Matrix().scale(scale, scale));
	}
	return path;
};

const BIRD_PATH = createBirdPath(BIRD_SIZE);

// Pipe component that reads from shared values - runs on UI thread
function Pipe({
	pipeX,
	pipeGapY,
	pipeActive,
	gameHeight,
	primaryColor,
}: {
	pipeX: SharedValue<number>;
	pipeGapY: SharedValue<number>;
	pipeActive: SharedValue<boolean>;
	gameHeight: number;
	primaryColor: string;
}) {
	const transform = useDerivedValue(() => {
		return [{ translateX: pipeX.value }];
	});

	const topHeight = useDerivedValue(() => pipeGapY.value);
	const topCapY = useDerivedValue(() => pipeGapY.value - 24);
	const bottomY = useDerivedValue(() => pipeGapY.value + PIPE_GAP);
	const bottomPipeY = useDerivedValue(() => pipeGapY.value + PIPE_GAP + 24);
	const bottomHeight = useDerivedValue(
		() => gameHeight - GROUND_HEIGHT - pipeGapY.value - PIPE_GAP,
	);
	const opacity = useDerivedValue(() => (pipeActive.value ? 1 : 0));

	return (
		<Group transform={transform} opacity={opacity}>
			{/* Top pipe */}
			<RoundedRect
				x={0}
				y={-8}
				width={PIPE_WIDTH}
				height={topHeight}
				r={0}
				color={primaryColor}
			/>
			<RoundedRect
				x={-4}
				y={topCapY}
				width={PIPE_WIDTH + 8}
				height={24}
				r={4}
				color={primaryColor}
			/>
			{/* Top pipe shading */}
			<RoundedRect
				x={4}
				y={0}
				width={8}
				height={topHeight}
				r={0}
				color="rgba(255,255,255,0.25)"
			/>
			<RoundedRect
				x={PIPE_WIDTH - 12}
				y={0}
				width={8}
				height={topHeight}
				r={0}
				color="rgba(0,0,0,0.15)"
			/>

			{/* Bottom pipe */}
			<RoundedRect
				x={0}
				y={bottomPipeY}
				width={PIPE_WIDTH}
				height={bottomHeight}
				r={0}
				color={primaryColor}
			/>
			<RoundedRect
				x={-4}
				y={bottomY}
				width={PIPE_WIDTH + 8}
				height={24}
				r={4}
				color={primaryColor}
			/>
			{/* Bottom pipe shading */}
			<RoundedRect
				x={4}
				y={bottomY}
				width={8}
				height={bottomHeight}
				r={0}
				color="rgba(255,255,255,0.25)"
			/>
			<RoundedRect
				x={PIPE_WIDTH - 12}
				y={bottomY}
				width={8}
				height={bottomHeight}
				r={0}
				color="rgba(0,0,0,0.15)"
			/>
		</Group>
	);
}

export function FlappyBird({ onClose, compact = false }: FlappyBirdProps) {
	const { width: screenWidth, height: screenHeight } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const primaryColor = useColor("primary");
	const backgroundColor = useColor("background");
	const cardColor = useColor("card");
	const mutedColor = useColor("textMuted");
	const secondaryColor = useColor("secondary");
	const tealColor = useColor("teal");
	const scheme = useColorScheme();
	const { playFlap, playScore, playHit } = useGameSounds();

	// Game dimensions
	const GAME_WIDTH = compact ? screenWidth - 48 : screenWidth - 32;
	const GAME_HEIGHT = compact ? 320 : screenHeight - 220;
	const BIRD_X = GAME_WIDTH * 0.2;

	// React state - only for UI overlays (idle, game over, score display)
	const [gameState, setGameState] = useState<"idle" | "playing" | "gameover">(
		"idle",
	);
	const [displayScore, setDisplayScore] = useState(0);

	// Track game state in shared values for immediate UI thread detection
	const isGameOver = useSharedValue(false);
	const isIdle = useSharedValue(true); // Start in idle state

	// High score from TinyBase
	const storedHighScore = useValue("flappy_bird_high_score") as
		| number
		| undefined;
	const highScore = storedHighScore ?? 0;
	const highScoreRef = useRef(highScore);
	highScoreRef.current = highScore;

	// ===== SHARED VALUES - These run on UI thread =====
	const birdY = useSharedValue(GAME_HEIGHT / 2);
	const birdVelocity = useSharedValue(0);
	const birdRotation = useSharedValue(0);
	const isPlaying = useSharedValue(false);
	const score = useSharedValue(0);
	const frameCount = useSharedValue(0); // Frame counter for pipe spawning

	// Track last frame timestamp for consistent timing
	const lastFrameTime = useSharedValue(0);

	// Pre-allocated pipe shared values (pool of MAX_PIPES)
	const pipe0X = useSharedValue(-100);
	const pipe0GapY = useSharedValue(150);
	const pipe0Active = useSharedValue(false);
	const pipe0Passed = useSharedValue(false);

	const pipe1X = useSharedValue(-100);
	const pipe1GapY = useSharedValue(150);
	const pipe1Active = useSharedValue(false);
	const pipe1Passed = useSharedValue(false);

	const pipe2X = useSharedValue(-100);
	const pipe2GapY = useSharedValue(150);
	const pipe2Active = useSharedValue(false);
	const pipe2Passed = useSharedValue(false);

	const pipe3X = useSharedValue(-100);
	const pipe3GapY = useSharedValue(150);
	const pipe3Active = useSharedValue(false);
	const pipe3Passed = useSharedValue(false);

	// Arrays for easier iteration in worklet
	const pipeXs = [pipe0X, pipe1X, pipe2X, pipe3X];
	const pipeGapYs = [pipe0GapY, pipe1GapY, pipe2GapY, pipe3GapY];
	const pipeActives = [pipe0Active, pipe1Active, pipe2Active, pipe3Active];
	const pipePasseds = [pipe0Passed, pipe1Passed, pipe2Passed, pipe3Passed];

	// Bird transform derived from shared values
	const birdTransform = useDerivedValue(() => [
		{ translateX: BIRD_X },
		{ translateY: birdY.value },
		{ translateX: BIRD_SIZE / 2 },
		{ translateY: BIRD_SIZE / 2 },
		{ rotate: (birdRotation.value * Math.PI) / 180 },
		{ translateX: -BIRD_SIZE / 2 },
		{ translateY: -BIRD_SIZE / 2 },
	]);

	// JS callbacks for sounds/haptics (called from worklet via runOnJS)
	const onScore = useCallback(() => {
		setDisplayScore((s) => s + 1);
		playScore();
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}
	}, [playScore]);

	const onGameOver = useCallback(
		(finalScore: number) => {
			setGameState("gameover");
			setDisplayScore(finalScore);
			if (finalScore > highScoreRef.current) {
				mainStore.setValue("flappy_bird_high_score", finalScore);
			}
			playHit();
			if (process.env.EXPO_OS === "ios") {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			}
		},
		[playHit],
	);

	// Reset game state (called from JS thread)
	const resetGameJS = useCallback(() => {
		setDisplayScore(0);
		setGameState("playing");
	}, []);

	// Reset game state on UI thread (worklet)
	const resetGameUI = () => {
		"worklet";
		birdY.value = GAME_HEIGHT / 2;
		birdVelocity.value = 0;
		birdRotation.value = 0;
		score.value = 0;
		frameCount.value = 0;
		lastFrameTime.value = 0;
		isGameOver.value = false;
		isIdle.value = false;
		isPlaying.value = true;

		// Reset all pipes
		for (let i = 0; i < MAX_PIPES; i++) {
			pipeXs[i].value = -100;
			pipeGapYs[i].value = 150;
			pipeActives[i].value = false;
			pipePasseds[i].value = false;
		}
	};

	// ===== GAME LOOP - Runs entirely on UI thread via useFrameCallback =====
	useFrameCallback((frameInfo) => {
		"worklet";

		if (!isPlaying.value || isGameOver.value) return;

		// Use actual timestamp for consistent timing regardless of frame drops
		const currentTime = frameInfo.timestamp;

		// Initialize lastFrameTime on first frame
		if (lastFrameTime.value === 0) {
			lastFrameTime.value = currentTime;
			return; // Skip first frame to establish baseline
		}

		// Calculate delta from actual timestamps (more reliable than timeSincePreviousFrame during heavy load)
		const rawDt = currentTime - lastFrameTime.value;
		lastFrameTime.value = currentTime;

		// Cap delta time to prevent large jumps when frames are dropped (e.g., during downloads)
		// Cap at 33ms (~30fps) - provides smooth gameplay while allowing reasonable catch-up
		const dt = Math.min(rawDt, 33);
		const timeScale = dt / (1000 / TARGET_FPS); // Scale relative to 60fps

		// Bird physics
		birdVelocity.value += GRAVITY * timeScale;
		birdY.value += birdVelocity.value * timeScale;
		birdRotation.value = Math.min(Math.max(birdVelocity.value * 6, -30), 90);

		// Ground/ceiling collision
		if (
			birdY.value < 0 ||
			birdY.value > GAME_HEIGHT - GROUND_HEIGHT - BIRD_SIZE
		) {
			isPlaying.value = false;
			isGameOver.value = true;
			runOnJS(onGameOver)(score.value);
			return;
		}

		// Accumulate time for pipe spawning (in ms)
		frameCount.value += dt;

		// Spawn new pipe every 1500ms
		const SPAWN_INTERVAL_MS = 1500;
		if (frameCount.value >= SPAWN_INTERVAL_MS) {
			frameCount.value = 0;
			// Find inactive pipe slot
			for (let i = 0; i < MAX_PIPES; i++) {
				if (!pipeActives[i].value) {
					const minGapY = 80;
					const maxGapY = GAME_HEIGHT - GROUND_HEIGHT - PIPE_GAP - 80;
					// Simple random using current time as seed
					const rand = ((Date.now() * 9301 + 49297) % 233280) / 233280;
					const gapY = minGapY + rand * (maxGapY - minGapY);

					pipeXs[i].value = GAME_WIDTH;
					pipeGapYs[i].value = gapY;
					pipeActives[i].value = true;
					pipePasseds[i].value = false;
					break;
				}
			}
		}

		// Move pipes and check collisions
		const pipeMovement = PIPE_SPEED * timeScale;

		for (let i = 0; i < MAX_PIPES; i++) {
			if (!pipeActives[i].value) continue;

			pipeXs[i].value -= pipeMovement;
			const pipeX = pipeXs[i].value;
			const gapY = pipeGapYs[i].value;

			// Score when bird passes pipe
			if (!pipePasseds[i].value && pipeX + PIPE_WIDTH < BIRD_X) {
				pipePasseds[i].value = true;
				score.value += 1;
				runOnJS(onScore)();
			}

			// Collision detection
			const birdRight = BIRD_X + BIRD_SIZE;
			const birdTop = birdY.value;
			const birdBottom = birdY.value + BIRD_SIZE;
			const pipeRight = pipeX + PIPE_WIDTH;

			if (birdRight > pipeX && BIRD_X < pipeRight) {
				if (birdTop < gapY || birdBottom > gapY + PIPE_GAP) {
					isPlaying.value = false;
					isGameOver.value = true;
					runOnJS(onGameOver)(score.value);
					return;
				}
			}

			// Remove off-screen pipes
			if (pipeX < -PIPE_WIDTH) {
				pipeActives[i].value = false;
			}
		}
	}, true); // Always run the callback

	// JS thread callbacks for sounds/haptics during jump
	const onJumpJS = useCallback(() => {
		playFlap();
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
	}, [playFlap]);

	const onRestartJS = useCallback(() => {
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}
	}, []);

	const restartGame = useCallback(() => {
		// Reset UI thread state
		resetGameUI();
		// Reset JS thread state
		resetGameJS();
		onRestartJS();
	}, [resetGameJS, onRestartJS]);

	// JS-based tap handler for Pressable (more reliable on Android)
	const handleTap = useCallback(() => {
		// Game over - ignore taps (must use restart button)
		if (isGameOver.value) return;

		// Idle state - start the game
		if (isIdle.value) {
			resetGameUI();
			resetGameJS();
			birdVelocity.value = JUMP_FORCE;
			onJumpJS();
			return;
		}

		// Playing - jump
		if (isPlaying.value) {
			birdVelocity.value = JUMP_FORCE;
			onJumpJS();
		}
	}, [resetGameJS, onJumpJS]);

	const skyColors =
		scheme === "dark"
			? [
					"rgba(255,158,55,0.15)",
					"rgba(255,91,145,0.12)",
					"rgba(105,183,255,0.1)",
					"transparent",
				]
			: [
					"rgba(255,158,55,0.12)",
					"rgba(255,91,145,0.1)",
					"rgba(105,183,255,0.08)",
					"transparent",
				];

	return (
		<View
			style={{
				flex: compact ? undefined : 1,
				backgroundColor: compact ? "transparent" : backgroundColor,
				paddingTop: compact
					? 0
					: 16 + (process.env.EXPO_OS === "android" ? insets.top : 0),
				paddingHorizontal: compact ? 0 : 16,
				paddingBottom: compact ? 0 : 16,
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
						<Text style={{ fontWeight: "700", color: tealColor }}>
							{displayScore}
						</Text>
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
			<View
				style={{
					width: GAME_WIDTH,
					height: GAME_HEIGHT,
					borderRadius: 16,
					overflow: "hidden",
				}}
			>
				<Canvas style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
					{/* Background */}
					<RoundedRect
						x={0}
						y={0}
						width={GAME_WIDTH}
						height={GAME_HEIGHT}
						r={16}
						color={cardColor}
					/>

					{/* Sky gradient */}
					<RoundedRect
						x={0}
						y={0}
						width={GAME_WIDTH}
						height={GAME_HEIGHT - GROUND_HEIGHT}
						r={16}
					>
						<LinearGradient
							start={vec(0, 0)}
							end={vec(GAME_WIDTH * 0.3, GAME_HEIGHT - GROUND_HEIGHT)}
							colors={skyColors}
						/>
					</RoundedRect>

					{/* Pipes - each reads directly from shared values */}
					<Pipe
						pipeX={pipe0X}
						pipeGapY={pipe0GapY}
						pipeActive={pipe0Active}
						gameHeight={GAME_HEIGHT}
						primaryColor={primaryColor}
					/>
					<Pipe
						pipeX={pipe1X}
						pipeGapY={pipe1GapY}
						pipeActive={pipe1Active}
						gameHeight={GAME_HEIGHT}
						primaryColor={primaryColor}
					/>
					<Pipe
						pipeX={pipe2X}
						pipeGapY={pipe2GapY}
						pipeActive={pipe2Active}
						gameHeight={GAME_HEIGHT}
						primaryColor={primaryColor}
					/>
					<Pipe
						pipeX={pipe3X}
						pipeGapY={pipe3GapY}
						pipeActive={pipe3Active}
						gameHeight={GAME_HEIGHT}
						primaryColor={primaryColor}
					/>

					{/* Bird */}
					<Group transform={birdTransform}>
						<Path
							path={BIRD_PATH}
							color={primaryColor}
							style="stroke"
							strokeWidth={2 * (BIRD_SIZE / 24)}
							strokeCap="round"
							strokeJoin="round"
						/>
					</Group>

					{/* Ground */}
					<RoundedRect
						x={0}
						y={GAME_HEIGHT - GROUND_HEIGHT}
						width={GAME_WIDTH}
						height={GROUND_HEIGHT}
						r={0}
						color={secondaryColor}
					/>
					<RoundedRect
						x={0}
						y={GAME_HEIGHT - GROUND_HEIGHT}
						width={GAME_WIDTH}
						height={4}
						r={0}
						color={`${mutedColor}4D`}
					/>
				</Canvas>

				{/* Idle overlay */}
				{gameState === "idle" && (
					<View
						pointerEvents="none"
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: GROUND_HEIGHT,
							justifyContent: "center",
							alignItems: "center",
							backgroundColor: "rgba(0,0,0,0.4)",
							borderTopLeftRadius: 16,
							borderTopRightRadius: 16,
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
						pointerEvents="box-none"
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: GROUND_HEIGHT,
							justifyContent: "center",
							alignItems: "center",
							backgroundColor: "rgba(0,0,0,0.8)",
							borderTopLeftRadius: 16,
							borderTopRightRadius: 16,
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
							Score: {displayScore}
						</Text>
						{displayScore === highScore && displayScore > 0 && (
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

				{/* Touch layer - handles taps for starting game and jumping */}
				{gameState !== "gameover" && (
					<Pressable
						onPress={handleTap}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
						}}
					/>
				)}
			</View>

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
