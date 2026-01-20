import { Audio } from "expo-av";
import { useCallback, useEffect, useRef } from "react";

// Simple sound URLs - using free game sound effects
// These are tiny base64 encoded WAV files for minimal latency
const SOUNDS = {
	flap: require("@/assets/audio/flap.wav"),
	score: require("@/assets/audio/score.wav"),
	hit: require("@/assets/audio/hit.wav"),
};

export function useGameSounds() {
	const soundsRef = useRef<{
		flap: Audio.Sound | null;
		score: Audio.Sound | null;
		hit: Audio.Sound | null;
	}>({
		flap: null,
		score: null,
		hit: null,
	});

	const isLoadedRef = useRef(false);

	// Load sounds on mount
	useEffect(() => {
		const loadSounds = async () => {
			try {
				// Configure audio mode for game sounds
				await Audio.setAudioModeAsync({
					playsInSilentModeIOS: true,
					staysActiveInBackground: false,
					shouldDuckAndroid: true,
				});

				const [flapResult, scoreResult, hitResult] = await Promise.all([
					Audio.Sound.createAsync(SOUNDS.flap, { volume: 0.5 }),
					Audio.Sound.createAsync(SOUNDS.score, { volume: 0.6 }),
					Audio.Sound.createAsync(SOUNDS.hit, { volume: 0.7 }),
				]);

				soundsRef.current.flap = flapResult.sound;
				soundsRef.current.score = scoreResult.sound;
				soundsRef.current.hit = hitResult.sound;
				isLoadedRef.current = true;
			} catch (error) {
				console.warn("[useGameSounds] Failed to load sounds:", error);
			}
		};

		loadSounds();

		// Cleanup on unmount
		return () => {
			const sounds = soundsRef.current;
			if (sounds.flap) sounds.flap.unloadAsync();
			if (sounds.score) sounds.score.unloadAsync();
			if (sounds.hit) sounds.hit.unloadAsync();
		};
	}, []);

	const playFlap = useCallback(async () => {
		if (!isLoadedRef.current || !soundsRef.current.flap) return;
		try {
			await soundsRef.current.flap.setPositionAsync(0);
			await soundsRef.current.flap.playAsync();
		} catch {
			// Ignore playback errors
		}
	}, []);

	const playScore = useCallback(async () => {
		if (!isLoadedRef.current || !soundsRef.current.score) return;
		try {
			await soundsRef.current.score.setPositionAsync(0);
			await soundsRef.current.score.playAsync();
		} catch {
			// Ignore playback errors
		}
	}, []);

	const playHit = useCallback(async () => {
		if (!isLoadedRef.current || !soundsRef.current.hit) return;
		try {
			await soundsRef.current.hit.setPositionAsync(0);
			await soundsRef.current.hit.playAsync();
		} catch {
			// Ignore playback errors
		}
	}, []);

	return {
		playFlap,
		playScore,
		playHit,
	};
}
