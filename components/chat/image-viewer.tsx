import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import type React from "react";
import { useCallback } from "react";
import {
	Dimensions,
	Modal,
	Pressable,
	StyleSheet,
	TouchableOpacity,
} from "react-native";
import {
	Gesture,
	GestureDetector,
	GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
	Dimensions.get("window");

interface ImageViewerProps {
	visible: boolean;
	uri: string;
	onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
	visible,
	uri,
	onClose,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const _theme = Colors[colorScheme];
	const insets = useSafeAreaInsets();

	const scale = useSharedValue(1);
	const savedScale = useSharedValue(1);
	const translateX = useSharedValue(0);
	const translateY = useSharedValue(0);
	const savedTranslateX = useSharedValue(0);
	const savedTranslateY = useSharedValue(0);

	const resetTransform = useCallback(() => {
		"worklet";
		scale.value = withTiming(1);
		savedScale.value = 1;
		translateX.value = withTiming(0);
		translateY.value = withTiming(0);
		savedTranslateX.value = 0;
		savedTranslateY.value = 0;
	}, []);

	const pinchGesture = Gesture.Pinch()
		.onUpdate((e) => {
			scale.value = savedScale.value * e.scale;
		})
		.onEnd(() => {
			if (scale.value < 1) {
				scale.value = withTiming(1);
				savedScale.value = 1;
				translateX.value = withTiming(0);
				translateY.value = withTiming(0);
				savedTranslateX.value = 0;
				savedTranslateY.value = 0;
			} else {
				savedScale.value = scale.value;
			}
		});

	const panGesture = Gesture.Pan()
		.onUpdate((e) => {
			if (savedScale.value > 1) {
				translateX.value = savedTranslateX.value + e.translationX;
				translateY.value = savedTranslateY.value + e.translationY;
			} else {
				// When not zoomed, vertical drag to dismiss
				translateY.value = e.translationY;
			}
		})
		.onEnd((e) => {
			if (savedScale.value > 1) {
				savedTranslateX.value = translateX.value;
				savedTranslateY.value = translateY.value;
			} else {
				// Dismiss if swiped down far enough
				if (Math.abs(e.translationY) > 150) {
					runOnJS(onClose)();
				}
				translateY.value = withTiming(0);
			}
		});

	const doubleTapGesture = Gesture.Tap()
		.numberOfTaps(2)
		.onEnd(() => {
			if (savedScale.value > 1) {
				resetTransform();
			} else {
				scale.value = withTiming(2.5);
				savedScale.value = 2.5;
			}
		});

	const composedGesture = Gesture.Simultaneous(
		pinchGesture,
		panGesture,
		doubleTapGesture,
	);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: translateX.value },
			{ translateY: translateY.value },
			{ scale: scale.value },
		],
	}));

	const handleClose = useCallback(() => {
		resetTransform();
		onClose();
	}, [onClose, resetTransform]);

	if (!visible) return null;

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={handleClose}
			statusBarTranslucent
		>
			<GestureHandlerRootView style={styles.root}>
				<Pressable
					style={[styles.backdrop, { backgroundColor: "rgba(0,0,0,0.95)" }]}
					onPress={handleClose}
				>
					<TouchableOpacity
						style={[styles.closeButton, { top: insets.top + 8 }]}
						onPress={handleClose}
						hitSlop={16}
					>
						<X size={24} color="#fff" strokeWidth={2} />
					</TouchableOpacity>

					<GestureDetector gesture={composedGesture}>
						<Animated.View style={[styles.imageContainer, animatedStyle]}>
							<Image
								source={{ uri }}
								style={styles.image}
								contentFit="contain"
							/>
						</Animated.View>
					</GestureDetector>
				</Pressable>
			</GestureHandlerRootView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	backdrop: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	closeButton: {
		position: "absolute",
		right: 16,
		zIndex: 10,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "rgba(0,0,0,0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	imageContainer: {
		width: SCREEN_WIDTH,
		height: SCREEN_HEIGHT,
		justifyContent: "center",
		alignItems: "center",
	},
	image: {
		width: SCREEN_WIDTH,
		height: SCREEN_HEIGHT * 0.8,
	},
});
