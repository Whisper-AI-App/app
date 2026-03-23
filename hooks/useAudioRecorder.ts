import type { MultimodalConstraints } from "@/src/ai-providers/types";
import {
	type RecordingOptions,
	AudioQuality,
	IOSOutputFormat,
	requestRecordingPermissionsAsync,
	setAudioModeAsync,
	useAudioRecorder as useExpoAudioRecorder,
	useAudioRecorderState,
} from "expo-audio";

/**
 * WAV recording preset: mono 16kHz 16-bit PCM.
 * Required for whisper.rn (whisper.cpp) transcription compatibility.
 */
const WAV_MONO_16K: RecordingOptions = {
	extension: ".wav",
	sampleRate: 16000,
	numberOfChannels: 1,
	bitRate: 256000,
	android: {
		// Android MediaRecorder doesn't natively output WAV,
		// but 3gp+amr_nb is a safe fallback that whisper.rn can handle.
		// For true WAV on Android, a post-record conversion would be needed.
		extension: ".amr",
		outputFormat: "amrnb",
		audioEncoder: "amr_nb",
		sampleRate: 16000,
	},
	ios: {
		extension: ".wav",
		outputFormat: IOSOutputFormat.LINEARPCM,
		audioQuality: AudioQuality.HIGH,
		sampleRate: 16000,
		linearPCMBitDepth: 16,
		linearPCMIsBigEndian: false,
		linearPCMIsFloat: false,
	},
	web: {
		mimeType: "audio/webm",
		bitsPerSecond: 128000,
	},
};
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, type AppStateStatus, Linking } from "react-native";

export interface AudioRecorderState {
	isRecording: boolean;
	isPaused: boolean;
	durationMs: number;
	uri: string | null;
	hasPermission: boolean | null;
}

export interface UseAudioRecorderReturn {
	recorderState: AudioRecorderState;
	startRecording: () => Promise<void>;
	stopRecording: () => Promise<string | null>;
	cancelRecording: () => Promise<void>;
}

/**
 * Custom audio recording hook with foreground-only enforcement,
 * max duration limits, and AppState lifecycle management.
 */
export function useAudioRecorder(
	constraints?: MultimodalConstraints,
): UseAudioRecorderReturn {
	const maxDuration = (constraints?.maxAudioDuration ?? 120) * 1000; // Convert to ms
	const [hasPermission, setHasPermission] = useState<boolean | null>(null);
	const [isRecording, setIsRecording] = useState(false);
	const isRecordingRef = useRef(false);
	const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const recorder = useExpoAudioRecorder(WAV_MONO_16K);
	const recorderStatus = useAudioRecorderState(recorder, 250);

	// Foreground-only: stop recording when app goes to background
	useEffect(() => {
		const handleAppStateChange = (nextState: AppStateStatus) => {
			if (nextState !== "active" && isRecordingRef.current) {
				// App went to background — stop recording, preserve partial
				recorder.stop();
				setIsRecording(false);
				isRecordingRef.current = false;
				if (maxDurationTimerRef.current) {
					clearTimeout(maxDurationTimerRef.current);
					maxDurationTimerRef.current = null;
				}
			}
		};

		const subscription = AppState.addEventListener(
			"change",
			handleAppStateChange,
		);
		return () => subscription.remove();
	}, [recorder]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (maxDurationTimerRef.current) {
				clearTimeout(maxDurationTimerRef.current);
			}
		};
	}, []);

	const startRecording = useCallback(async () => {
		// Request permission
		const { granted } = await requestRecordingPermissionsAsync();
		setHasPermission(granted);
		if (!granted) {
			Alert.alert(
				"Microphone Access Required",
				"Please enable microphone access in your device settings to record audio.",
				[
					{ text: "Cancel", style: "cancel" },
					{ text: "Open Settings", onPress: () => Linking.openSettings() },
				],
			);
			return;
		}

		// Configure audio mode for recording
		await setAudioModeAsync({
			allowsRecording: true,
			playsInSilentMode: true,
		});

		await recorder.prepareToRecordAsync();
		recorder.record();
		setIsRecording(true);
		isRecordingRef.current = true;

		// Set max duration timer
		if (maxDuration > 0) {
			maxDurationTimerRef.current = setTimeout(async () => {
				if (isRecordingRef.current) {
					await recorder.stop();
					setIsRecording(false);
					isRecordingRef.current = false;
				}
			}, maxDuration);
		}
	}, [recorder, maxDuration]);

	const stopRecording = useCallback(async (): Promise<string | null> => {
		if (!isRecordingRef.current) return null;

		if (maxDurationTimerRef.current) {
			clearTimeout(maxDurationTimerRef.current);
			maxDurationTimerRef.current = null;
		}

		await recorder.stop();
		setIsRecording(false);
		isRecordingRef.current = false;

		// Reset audio mode
		await setAudioModeAsync({
			allowsRecording: false,
		});

		return recorder.uri;
	}, [recorder]);

	const cancelRecording = useCallback(async () => {
		if (!isRecordingRef.current) return;

		if (maxDurationTimerRef.current) {
			clearTimeout(maxDurationTimerRef.current);
			maxDurationTimerRef.current = null;
		}

		await recorder.stop();
		setIsRecording(false);
		isRecordingRef.current = false;

		// Reset audio mode
		await setAudioModeAsync({
			allowsRecording: false,
		});
	}, [recorder]);

	return {
		recorderState: {
			isRecording,
			isPaused: false,
			durationMs: recorderStatus.durationMillis ?? 0,
			uri: recorder.uri,
			hasPermission,
		},
		startRecording,
		stopRecording,
		cancelRecording,
	};
}
