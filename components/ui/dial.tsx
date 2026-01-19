import { useCallback, useRef, useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useColor } from "@/hooks/useColor";
import { Text } from "@/components/ui/text";

interface DialProps {
  value: number;
  onValueChange: (value: number) => void;
  onDialComplete?: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  size?: number;
  label?: string;
  unit?: string;
  activeColor?: string;
  trackColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

const START_ANGLE_DEG = 135;
const SWEEP_ANGLE_DEG = 270;

// Convert polar to cartesian coordinates
function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

// Create SVG arc path
function createArcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function Dial({
  value,
  onValueChange,
  onDialComplete,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  size = 120,
  label,
  unit = "",
  activeColor,
  trackColor,
  style,
  disabled = false,
}: DialProps) {
  const defaultActiveColor = useColor("primary");
  const defaultTrackColor = useColor("border");
  const textColor = useColor("text");
  const mutedColor = useColor("textMuted");

  const lastSteppedValue = useRef(value);
  const lastHapticTime = useRef(0);
  const currentValueRef = useRef(value);
  const lastAdjustedAngle = useRef(((value - minimumValue) / (maximumValue - minimumValue)) * SWEEP_ANGLE_DEG);

  const rotation = useSharedValue(START_ANGLE_DEG + ((value - minimumValue) / (maximumValue - minimumValue)) * SWEEP_ANGLE_DEG);
  const thumbScale = useSharedValue(1);

  // Sync rotation and lastAdjustedAngle when value changes externally (e.g., reset)
  useEffect(() => {
    const newAngle = ((value - minimumValue) / (maximumValue - minimumValue)) * SWEEP_ANGLE_DEG;
    rotation.value = START_ANGLE_DEG + newAngle;
    lastAdjustedAngle.current = newAngle;
  }, [value, minimumValue, maximumValue, rotation]);

  const strokeWidth = Math.max(6, size * 0.06);
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;
  const thumbSize = strokeWidth + 10;

  const triggerHaptic = useCallback(() => {
    const now = Date.now();
    if (now - lastHapticTime.current > 50) {
      lastHapticTime.current = now;
      Haptics.selectionAsync();
    }
  }, []);

  const updateValue = useCallback(
    (x: number, y: number) => {
      if (disabled) return;

      const dx = x - center;
      const dy = y - center;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;

      let adjusted = angle - START_ANGLE_DEG;
      if (adjusted < 0) adjusted += 360;

      const prev = lastAdjustedAngle.current;

      // If in the gap area, clamp based on previous position
      if (adjusted > SWEEP_ANGLE_DEG) {
        if (prev > SWEEP_ANGLE_DEG / 2) {
          adjusted = SWEEP_ANGLE_DEG;
        } else {
          adjusted = 0;
        }
      } else {
        // Limit maximum change per update to prevent jumps
        const maxDelta = 30;
        const delta = adjusted - prev;
        if (Math.abs(delta) > maxDelta) {
          adjusted = prev + Math.sign(delta) * maxDelta;
        }
      }

      const normalizedAngle = Math.max(0, Math.min(SWEEP_ANGLE_DEG, adjusted));
      lastAdjustedAngle.current = normalizedAngle;
      let newValue = minimumValue + (normalizedAngle / SWEEP_ANGLE_DEG) * (maximumValue - minimumValue);

      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }
      newValue = Math.max(minimumValue, Math.min(maximumValue, newValue));

      currentValueRef.current = newValue;
      rotation.value = START_ANGLE_DEG + normalizedAngle;

      if (newValue !== lastSteppedValue.current) {
        lastSteppedValue.current = newValue;
        triggerHaptic();
      }

      onValueChange(newValue);
    },
    [disabled, center, minimumValue, maximumValue, step, onValueChange, triggerHaptic, rotation]
  );

  const handleComplete = useCallback(() => {
    if (onDialComplete) {
      onDialComplete(currentValueRef.current);
    }
  }, [onDialComplete]);

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      thumbScale.value = withSpring(1.3, { damping: 15, stiffness: 300 });
      runOnJS(updateValue)(event.x, event.y);
    })
    .onUpdate((event) => {
      runOnJS(updateValue)(event.x, event.y);
    })
    .onEnd(() => {
      thumbScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      runOnJS(handleComplete)();
    })
    .enabled(!disabled);

  const tapGesture = Gesture.Tap()
    .onStart(() => {
      thumbScale.value = withSpring(1.3, { damping: 15, stiffness: 300 });
    })
    .onEnd((event) => {
      thumbScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      runOnJS(updateValue)(event.x, event.y);
      runOnJS(handleComplete)();
    })
    .enabled(!disabled);

  const gesture = Gesture.Race(panGesture, tapGesture);

  const animatedThumbStyle = useAnimatedStyle(() => {
    const rot = rotation.value;
    const rad = (rot * Math.PI) / 180;
    return {
      left: center + radius * Math.cos(rad) - thumbSize / 2,
      top: center + radius * Math.sin(rad) - thumbSize / 2,
      transform: [{ scale: thumbScale.value }],
    };
  });

  const resolvedTrackColor = trackColor || defaultTrackColor;
  const resolvedActiveColor = activeColor || defaultActiveColor;

  // Calculate the arc paths
  const normalizedValue = (value - minimumValue) / (maximumValue - minimumValue);
  const activeEndAngle = START_ANGLE_DEG + normalizedValue * SWEEP_ANGLE_DEG;

  // Full track path
  const trackPath = createArcPath(center, center, radius, START_ANGLE_DEG, START_ANGLE_DEG + SWEEP_ANGLE_DEG);

  // Active arc path (only if there's some value)
  const activePath = normalizedValue > 0.01
    ? createArcPath(center, center, radius, START_ANGLE_DEG, activeEndAngle)
    : "";

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      )}
      <GestureDetector gesture={gesture}>
        <View style={[styles.dialContainer, { width: size, height: size }]}>
          {/* SVG Arcs */}
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            {/* Background track */}
            <Path
              d={trackPath}
              stroke={resolvedTrackColor}
              strokeWidth={strokeWidth}
              fill="none"
              opacity={0.3}
              strokeLinecap="round"
            />
            {/* Active arc */}
            {activePath && (
              <Path
                d={activePath}
                stroke={resolvedActiveColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            )}
          </Svg>

          {/* Thumb/indicator */}
          <Animated.View
            style={[
              styles.thumb,
              {
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                backgroundColor: resolvedActiveColor,
                opacity: disabled ? 0.5 : 1,
              },
              animatedThumbStyle,
            ]}
          />

          {/* Center value display */}
          <View style={styles.centerContent}>
            <Text style={[styles.value, { color: textColor, fontSize: size * 0.22 }]}>
              {Math.round(value)}{unit}
            </Text>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  dialContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  thumb: {
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  centerContent: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  value: {
    fontWeight: "600",
  },
});
