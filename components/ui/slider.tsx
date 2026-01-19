import { useCallback, useRef } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useColor } from "@/hooks/useColor";

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  /** Called when the user finishes dragging the slider */
  onSlidingComplete?: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  trackHeight?: number;
  thumbSize?: number;
  trackColor?: string;
  activeTrackColor?: string;
  thumbColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function Slider({
  value,
  onValueChange,
  onSlidingComplete,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  trackHeight = 6,
  thumbSize = 24,
  trackColor,
  activeTrackColor,
  thumbColor,
  style,
  disabled = false,
}: SliderProps) {
  const defaultTrackColor = useColor("border");
  const defaultActiveColor = useColor("primary");
  const defaultThumbColor = useColor("card");

  const trackWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const lastSteppedValue = useRef(value);
  const currentDragValue = useRef(value);
  const lastHapticTime = useRef(0);

  const range = maximumValue - minimumValue;
  const normalizedValue = (value - minimumValue) / range;

  // Throttle haptics to max ~30 per second for performance
  const triggerHaptic = useCallback(() => {
    const now = Date.now();
    if (now - lastHapticTime.current > 33) {
      lastHapticTime.current = now;
      Haptics.selectionAsync();
    }
  }, []);

  const updateValue = useCallback(
    (x: number, width: number) => {
      if (disabled || width === 0) return;

      const clampedX = Math.max(0, Math.min(x, width));
      const normalizedX = clampedX / width;
      let newValue = minimumValue + normalizedX * range;

      // Apply step
      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }

      // Clamp to range
      newValue = Math.max(minimumValue, Math.min(maximumValue, newValue));

      // Track current drag value for onSlidingComplete
      currentDragValue.current = newValue;

      // Trigger haptic feedback when stepping to a new value
      if (newValue !== lastSteppedValue.current) {
        lastSteppedValue.current = newValue;
        triggerHaptic();
      }

      onValueChange(newValue);
    },
    [disabled, minimumValue, maximumValue, range, step, onValueChange, triggerHaptic]
  );

  const handleSlidingComplete = useCallback(() => {
    if (onSlidingComplete) {
      onSlidingComplete(currentDragValue.current);
    }
  }, [onSlidingComplete]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      translateX.value = normalizedValue * trackWidth.value;
    })
    .onUpdate((event) => {
      const x = translateX.value + event.translationX;
      runOnJS(updateValue)(x, trackWidth.value);
    })
    .onEnd(() => {
      runOnJS(handleSlidingComplete)();
    })
    .enabled(!disabled);

  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      runOnJS(updateValue)(event.x, trackWidth.value);
      runOnJS(handleSlidingComplete)();
    })
    .enabled(!disabled);

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    const position = normalizedValue * trackWidth.value;
    return {
      transform: [{ translateX: position - thumbSize / 2 }],
    };
  });

  const activeTrackAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${normalizedValue * 100}%`,
    };
  });

  return (
    <View style={[styles.container, style]}>
      <GestureDetector gesture={composedGesture}>
        <View
          style={[styles.trackContainer, { height: thumbSize }]}
          onLayout={(event) => {
            trackWidth.value = event.nativeEvent.layout.width;
          }}
        >
          {/* Background track */}
          <View
            style={[
              styles.track,
              {
                height: trackHeight,
                backgroundColor: trackColor || defaultTrackColor,
                borderRadius: trackHeight / 2,
              },
            ]}
          />

          {/* Active track */}
          <Animated.View
            style={[
              styles.activeTrack,
              {
                height: trackHeight,
                backgroundColor: activeTrackColor || defaultActiveColor,
                borderRadius: trackHeight / 2,
              },
              activeTrackAnimatedStyle,
            ]}
          />

          {/* Thumb */}
          <Animated.View
            style={[
              styles.thumb,
              {
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                backgroundColor: thumbColor || defaultThumbColor,
                borderColor: activeTrackColor || defaultActiveColor,
                opacity: disabled ? 0.5 : 1,
              },
              thumbAnimatedStyle,
            ]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  trackContainer: {
    width: "100%",
    justifyContent: "center",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  activeTrack: {
    position: "absolute",
    left: 0,
  },
  thumb: {
    position: "absolute",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
