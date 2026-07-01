import { StyleSheet, View } from "react-native";
import Svg, {
	Defs,
	G,
	LinearGradient,
	Path,
	Rect,
	Stop,
} from "react-native-svg";

// Path data lifted directly from assets/images/icon-variants/bird.svg
// so the live preview matches the real generated icon pixel-for-pixel.
const BIRD_PATHS = [
	"m 16,6 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 h 0.0098 a 1,1 0 0 0 1,-1 1,1 0 0 0 -1,-1 z",
	"M 14.5,2.2148438 C 13.507948,2.5218127 12.584121,3.1473905 11.900391,4.1269531 L 1.1816406,19.425781 a 1,1 0 0 0 0.2441406,1.392578 1,1 0 0 0 1.3925782,-0.24414 L 3.921875,19 H 12 c 4.958718,0 9,-4.041282 9,-9 V 7.0019531 7 C 21.0054,4.6118632 19.414041,2.8255159 17.505859,2.2226563 16.551497,1.9211406 15.492052,1.9078748 14.5,2.2148438 Z m 0.609375,1.8769531 C 15.69423,3.9163927 16.317752,3.9435967 16.904297,4.1289062 18.077387,4.4995254 19.004041,5.4681891 19,6.9980469 A 1.0001,1.0001 0 0 0 19,7 v 3 c 0,3.877838 -3.122162,7 -7,7 H 5.3222656 L 13.539063,5.2734375 a 1.0001,1.0001 0 0 0 0,-0.00195 C 13.976878,4.6442378 14.52452,4.267201 15.109375,4.0917969 Z",
	"m 20.242187,6.0292969 a 1,1 0 0 0 -1.21289,0.7285156 1,1 0 0 0 0.33789,0.921875 1,1 0 0 0 -0.33789,0.5625 1,1 0 0 0 1.21289,0.7285156 l 2,-0.5 a 1.0001,1.0001 0 0 0 0,-1.9414062 z",
	"m 10,17 a 1,1 0 0 0 -1,1 v 3 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -3 a 1,1 0 0 0 -1,-1 z",
	"m 14,16.75 a 1,1 0 0 0 -1,1 V 21 a 1,1 0 0 0 1,1 1,1 0 0 0 1,-1 v -3.25 a 1,1 0 0 0 -1,-1 z",
	"M 11.480469,6.6210937 A 1,1 0 0 0 10.072266,6.75 1,1 0 0 0 10.199219,8.1582031 c 1.835756,1.5292528 2.171704,3.6924329 1.501953,5.5429689 C 11.031421,15.551708 9.3892712,16.999881 7,17 a 1,1 0 0 0 -1,1 1,1 0 0 0 1,1 c 3.222883,-1.61e-4 5.656819,-2.060808 6.582031,-4.617187 0.925212,-2.55638 0.374686,-5.6989134 -2.101562,-7.7617193 z",
];

export type IconBackground =
	| { type: "solid"; color: string }
	| { type: "gradient"; stops: [string, string] };

interface BirdIconPreviewProps {
	birdColor: string;
	background: IconBackground;
	size?: number;
	birdOpacity?: number;
}

export function BirdIconPreview({
	birdColor,
	background,
	size = 96,
	birdOpacity = 0.85,
}: BirdIconPreviewProps) {
	const birdScale = (size * 0.7) / 24;
	const offset = (size - size * 0.7) / 2;
	const gradientId = "preview-bg-gradient";

	return (
		<View
			style={[
				styles.wrapper,
				{ width: size, height: size, borderRadius: size * 0.22 },
			]}
		>
			<Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
				<Defs>
					{background.type === "gradient" && (
						<LinearGradient id={gradientId} x1="50%" y1="100%" x2="50%" y2="0%">
							<Stop offset="0%" stopColor={background.stops[0]} />
							<Stop offset="100%" stopColor={background.stops[1]} />
						</LinearGradient>
					)}
				</Defs>
				<Rect
					width={size}
					height={size}
					fill={
						background.type === "solid"
							? background.color
							: `url(#${gradientId})`
					}
				/>
				<G
					transform={`translate(${offset}, ${offset}) scale(${birdScale})`}
					opacity={birdOpacity}
				>
					{BIRD_PATHS.map((d) => (
						<Path key={d.slice(0, 12)} d={d} fill={birdColor} />
					))}
				</G>
			</Svg>
		</View>
	);
}

const styles = StyleSheet.create({
	wrapper: {
		overflow: "hidden",
	},
});