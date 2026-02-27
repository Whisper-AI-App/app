import React, { useEffect } from "react";
import {
	Dimensions,
	Modal,
	TouchableWithoutFeedback,
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
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { BORDER_RADIUS } from "@/theme/globals";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface TopSheetProps {
	isVisible: boolean;
	onClose: () => void;
	children: React.ReactNode;
	maxHeight?: number;
}

export function TopSheet({
	isVisible,
	onClose,
	children,
	maxHeight: maxHeightProp,
}: TopSheetProps) {
	const cardColor = useColor("card");
	const mutedColor = useColor("muted");
	const insets = useSafeAreaInsets();

	const maxHeight = maxHeightProp ?? SCREEN_HEIGHT * 0.6;
	const translateY = useSharedValue(-maxHeight);
	const opacity = useSharedValue(0);
	const context = useSharedValue({ y: 0 });
	const [modalVisible, setModalVisible] = React.useState(false);

	useEffect(() => {
		if (isVisible) {
			setModalVisible(true);
			translateY.value = withSpring(0, {
				damping: 18,
				stiffness: 140,
				mass: 1,
			});
			opacity.value = withTiming(1, { duration: 300 });
		} else {
			translateY.value = withSpring(-maxHeight, {
				damping: 50,
				stiffness: 400,
			});
			opacity.value = withTiming(0, { duration: 300 }, (finished) => {
				if (finished) {
					runOnJS(setModalVisible)(false);
				}
			});
		}
	}, [isVisible, maxHeight]);

	const animateClose = () => {
		"worklet";
		translateY.value = withSpring(-maxHeight, {
			damping: 50,
			stiffness: 400,
		});
		opacity.value = withTiming(0, { duration: 300 }, (finished) => {
			if (finished) {
				runOnJS(onClose)();
			}
		});
	};

	const gesture = Gesture.Pan()
		.onStart(() => {
			context.value = { y: translateY.value };
		})
		.onUpdate((event) => {
			// Only allow dragging upward (negative direction) from current position
			const newY = context.value.y + event.translationY;
			if (newY <= 0) {
				translateY.value = newY;
			}
		})
		.onEnd((event) => {
			const velocity = event.velocityY;

			// If dragging up fast or past threshold, close
			if (velocity < -500 || translateY.value < -maxHeight * 0.3) {
				animateClose();
			} else {
				// Snap back open
				translateY.value = withSpring(0, {
					damping: 18,
					stiffness: 140,
				});
			}
		});

	const rSheetStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}));

	const rBackdropStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
	}));

	return (
		<Modal
			visible={modalVisible}
			transparent
			statusBarTranslucent
			animationType="none"
		>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<Animated.View
					style={[
						{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)" },
						rBackdropStyle,
					]}
				>
					<GestureDetector gesture={gesture}>
						<Animated.View
							style={[
								{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									maxHeight,
									backgroundColor: cardColor,
									borderBottomLeftRadius: BORDER_RADIUS,
									borderBottomRightRadius: BORDER_RADIUS,
								},
								rSheetStyle,
							]}
						>
							{/* Content with safe area top padding */}
							<View style={{ flex: 1, paddingTop: insets.top }}>
								{children}
							</View>

							{/* Bottom drag handle */}
							<View
								style={{
									width: "100%",
									paddingVertical: 10,
									alignItems: "center",
								}}
							>
								<View
									style={{
										width: 40,
										height: 4,
										backgroundColor: mutedColor,
										borderRadius: 999,
									}}
								/>
							</View>
						</Animated.View>
					</GestureDetector>

					{/* Backdrop tap area (below the sheet) */}
					<TouchableWithoutFeedback onPress={onClose}>
						<View style={{ flex: 1, marginTop: maxHeight }} />
					</TouchableWithoutFeedback>
				</Animated.View>
			</GestureHandlerRootView>
		</Modal>
	);
}
