import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useCallback, useEffect } from "react";

export function useGameSounds() {
	const flapPlayer = useAudioPlayer(require("@/assets/audio/flap.wav"));
	const scorePlayer = useAudioPlayer(require("@/assets/audio/score.wav"));
	const hitPlayer = useAudioPlayer(require("@/assets/audio/hit.wav"));

	useEffect(() => {
		setAudioModeAsync({
			playsInSilentMode: true,
			shouldPlayInBackground: false,
		});

		flapPlayer.volume = 0.5;
		scorePlayer.volume = 0.6;
		hitPlayer.volume = 0.7;
	}, [flapPlayer, scorePlayer, hitPlayer]);

	const playFlap = useCallback(async () => {
		try {
			await flapPlayer.seekTo(0);
			flapPlayer.play();
		} catch {
			// Ignore playback errors
		}
	}, [flapPlayer]);

	const playScore = useCallback(async () => {
		try {
			await scorePlayer.seekTo(0);
			scorePlayer.play();
		} catch {
			// Ignore playback errors
		}
	}, [scorePlayer]);

	const playHit = useCallback(async () => {
		try {
			await hitPlayer.seekTo(0);
			hitPlayer.play();
		} catch {
			// Ignore playback errors
		}
	}, [hitPlayer]);

	return {
		playFlap,
		playScore,
		playHit,
	};
}
