import { ChatBackground } from "@/components/chat-background";
import { AttachmentButton } from "@/components/chat/attachment-button";
import { AttachmentPreview } from "@/components/chat/attachment-preview";
import { AudioRecorderOverlay } from "@/components/chat/audio-recorder-overlay";
import { ChatPageHeader } from "@/components/chat/chat-page-header";
import { ImageViewer } from "@/components/chat/image-viewer";
import { MoveToFolderSheet } from "@/components/move-to-folder-sheet";
import { OfflineBanner } from "@/components/offline-banner";
import { ProviderAndModelSelector } from "@/components/ProviderAndModelSelector";
import { SuggestionCards } from "@/components/suggestion-cards";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useAttachments } from "@/hooks/useAttachments";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useChatCompletion } from "@/hooks/useChatCompletion";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatRenderers } from "@/hooks/useChatRenderers";
import { useChatState } from "@/hooks/useChatState";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useNetworkState } from "@/hooks/useNetworkState";
import { setMessageStatus } from "@/src/actions/message";
import {
	NO_MULTIMODAL,
	type PendingAttachment,
} from "@/src/ai-providers/types";
import { getTranscription } from "@/src/stt";
import { wouldTruncate } from "@/src/utils/context-window";
import { Colors } from "@/theme/colors";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Camera, Mic } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	View as RNView,
	TouchableOpacity,
} from "react-native";
import { GiftedChat, type IMessage } from "react-native-gifted-chat";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCell, useSortedRowIds, useTable } from "tinybase/ui-react";

export default function ChatPage() {
	const router = useRouter();
	const { id: chatIdParam, folderId: folderIdParam } = useLocalSearchParams<{
		id?: string;
		folderId?: string;
	}>();

	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const [, setIsInputFocused] = useState(false);
	const [inputText, setInputText] = useState("");
	const [moveToFolderSheetOpen, setMoveToFolderSheetOpen] = useState(false);

	// Get folder data for move sheet
	const folderIds = useSortedRowIds("folders", "createdAt", false);
	const foldersTable = useTable("folders");
	const chatsTable = useTable("chats");

	const foldersWithCounts = useMemo(() => {
		return folderIds.map((folderId) => {
			const folder = foldersTable[folderId];
			const chatCount = Object.values(chatsTable).filter(
				(chat) => chat?.folderId === folderId,
			).length;
			return {
				id: folderId,
				name: String(folder?.name || "Untitled"),
				chatCount,
			};
		});
	}, [folderIds, foldersTable, chatsTable]);

	const handleClose = useCallback(() => {
		router.back();
	}, [router]);

	// Chat state management
	const {
		currentChatId,
		setCurrentChatId,
		chatRow,
		isMenuOpen,
		setIsMenuOpen,
		handleShareChat,
		handleRenameChat,
		handleDeleteChat,
		handleNewChat: handleNewChatState,
		renamePromptVisible,
		setRenamePromptVisible,
		handleConfirmRename,
	} = useChatState({
		initialChatId: chatIdParam,
		onClose: handleClose,
	});

	// Messages from TinyBase
	const { messages, lastAssistantStatus, lastAssistantId } =
		useChatMessages(currentChatId);

	// Get contextSize and multimodal capabilities from active provider
	const { activeProvider, setupError } = useAIProvider();
	const contextSize = activeProvider?.getContextSize() ?? 2048;
	// Subscribe to capabilitiesVersion so we re-render when capabilities change
	// asynchronously (e.g., vision init completes, memory pressure releases a tier)
	useCell("aiProviders", activeProvider?.id ?? "", "capabilitiesVersion");
	const multimodalCaps =
		activeProvider?.getMultimodalCapabilities() ?? NO_MULTIMODAL;
	const { isConnected } = useNetworkState();
	const isCloudProvider = activeProvider?.type === "cloud";
	const isOfflineCloud = isCloudProvider && !isConnected;

	// Attachment state
	const {
		attachments,
		addImageAttachment,
		addAudioAttachment,
		removeAttachment,
		clearAttachments,
		canAddImage,
		canAddAudio,
	} = useAttachments();

	const handleTakePhoto = useCallback(async () => {
		const { status } = await ImagePicker.requestCameraPermissionsAsync();
		if (status !== "granted") {
			Alert.alert(
				"Camera Access Required",
				"Please enable camera access in your device settings to use this feature.",
				[
					{ text: "Cancel", style: "cancel" },
					{ text: "Open Settings", onPress: () => Linking.openSettings() },
				],
			);
			return;
		}
		const result = await ImagePicker.launchCameraAsync({
			mediaTypes: ["images"],
			quality: 1,
		});
		if (!result.canceled && result.assets[0]) {
			const asset = result.assets[0];
			addImageAttachment(
				asset.uri,
				asset.mimeType ?? "image/jpeg",
				asset.width,
				asset.height,
				asset.fileName ?? undefined,
				asset.fileSize ?? undefined,
			);
		}
	}, [addImageAttachment]);

	// Audio recorder
	const { recorderState, startRecording, stopRecording, cancelRecording } =
		useAudioRecorder(multimodalCaps.constraints);

	const [isTranscribing, setIsTranscribing] = useState(false);

	const handleSendRecording = useCallback(async () => {
		const uri = await stopRecording();
		if (!uri) return;

		// Build the audio attachment object directly (don't rely on async state updates)
		const audioAtt: PendingAttachment = {
			id: `rec_${Date.now()}`,
			type: "audio",
			uri,
			mimeType: "audio/wav",
			fileName: `recording_${Date.now()}.wav`,
			fileSize: 0,
			duration: recorderState.durationMs / 1000,
		};

		// Snapshot current input text and any pre-existing attachments
		const capturedText = inputText.trim();
		const priorAttachments = [...attachments];

		// Also add to React state so the preview shows while transcribing
		addAudioAttachment(
			uri,
			"audio/wav",
			audioAtt.fileName,
			0,
			audioAtt.duration,
		);

		// Transcribe, then send.
		// whisper.rn runs on its own native context (whisper.cpp), independent of
		// llama.rn (llama.cpp). No need to suspend/reload the LLM — they coexist.
		setIsTranscribing(true);

		const transcribeAndSend = async () => {
			try {
				const transcription = await getTranscription(uri);

				if (transcription?.trim()) {
					audioAtt.transcription = transcription;
				}
			} catch (err) {
				console.warn("[chat] STT failed:", err);
			} finally {
				setIsTranscribing(false);
			}

			// Send message with our locally-built attachment list
			const allAttachments = [...priorAttachments, audioAtt];
			setInputText("");
			clearAttachments();
			await sendMessage(capturedText, allAttachments);
		};

		transcribeAndSend();
	}, [
		stopRecording,
		addAudioAttachment,
		recorderState.durationMs,
		inputText,
		attachments,
		clearAttachments,
		sendMessage,
	]);

	// Clear incompatible attachments when provider/model changes
	const activeProviderId = activeProvider?.id;
	useEffect(() => {
		if (attachments.length === 0) return;
		const caps = activeProvider?.getMultimodalCapabilities();
		if (!caps) {
			clearAttachments();
			return;
		}
		// Remove attachments not supported by new provider
		const hasIncompatible = attachments.some((att) => {
			if (att.type === "image" && !caps.vision) return true;
			if (att.type === "audio" && !caps.audio) return true;
			if (att.type === "file" && !caps.files) return true;
			return false;
		});
		if (hasIncompatible) {
			clearAttachments();
		}
	}, [activeProviderId]);

	// Image viewer state
	const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
	const handleImagePress = useCallback((uri: string) => {
		setViewerImageUri(uri);
	}, []);
	const handleCloseViewer = useCallback(() => {
		setViewerImageUri(null);
	}, []);

	// Show warning when conversation will be truncated
	const showTruncationWarning = useMemo(() => {
		const totalChars = messages.reduce((sum, m) => sum + m.text.length, 0);
		return wouldTruncate(totalChars, contextSize);
	}, [messages, contextSize]);

	// AI completion orchestration
	const {
		isAiTyping,
		isProcessingMedia,
		isContinuing,
		streamingText,
		sendMessage,
		stopGeneration,
		continueMessage,
		clearInferenceCache,
	} = useChatCompletion({
		chatId: currentChatId,
		messages,
		onChatCreated: setCurrentChatId,
		folderId: folderIdParam || null,
	});

	// Dismiss notice: set status to "done" so the notice disappears
	const onDismissNotice = useCallback(() => {
		if (!lastAssistantId) return;
		if (
			lastAssistantStatus === "error" ||
			lastAssistantStatus === "length" ||
			lastAssistantStatus === "cancelled"
		) {
			setMessageStatus(lastAssistantId, "done");
		}
	}, [lastAssistantId, lastAssistantStatus]);

	// Continue: use in-memory context if available, otherwise send a user message
	const handleContinue = useCallback(async () => {
		if (continueMessage) {
			await continueMessage();
		} else {
			await sendMessage("Continue from where you left off.");
		}
	}, [continueMessage, sendMessage]);

	// Handle new chat
	const handleNewChat = useCallback(() => {
		clearInferenceCache();
		handleNewChatState();
		router.setParams({ id: undefined });
	}, [handleNewChatState, clearInferenceCache, router]);

	// GiftedChat render functions
	const {
		defaultContainerStyle,
		renderBubble,
		renderAvatar,
		renderInputToolbar,
		InputToolbar,
	} = useChatRenderers({
		setIsInputFocused,
		isTyping: isAiTyping,
		isNewChat: !currentChatId,
		isFullPage: true,
		lastMessageStatus: lastAssistantStatus,
		onContinue: handleContinue,
		onStop: stopGeneration,
		onDismissNotice,
		onImagePress: handleImagePress,
	});

	const handleSuggestionPress = useCallback((text: string) => {
		setInputText(text);
	}, []);

	const handleMoveToFolder = useCallback(() => {
		setIsMenuOpen(false);
		setMoveToFolderSheetOpen(true);
	}, [setIsMenuOpen]);

	const currentChatFolderId = currentChatId
		? String(chatsTable[currentChatId]?.folderId || "")
		: "";

	const onSend = useCallback(
		async (newMessages: IMessage[] = []) => {
			if (newMessages.length === 0) return;
			const userMessage = newMessages[0];
			const currentAttachments =
				attachments.length > 0 ? [...attachments] : undefined;
			setInputText("");
			clearAttachments();
			await sendMessage(userMessage.text, currentAttachments);
		},
		[sendMessage, attachments, clearAttachments],
	);

	useEffect(() => {
		clearInferenceCache();
	}, [clearInferenceCache, currentChatId]);

	return (
		<RNView style={{ flex: 1 }}>
			<ChatBackground asBackgroundLayer />
			<SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
				<View style={{ flex: 1 }}>
					<ChatPageHeader
						centerContent={
							<ProviderAndModelSelector shrink={messages.length > 0} />
						}
						chatName={chatRow.name as string | undefined}
						hasMessages={messages.length > 0}
						onClose={handleClose}
						onNewChat={handleNewChat}
						isMenuOpen={isMenuOpen}
						onMenuOpenChange={setIsMenuOpen}
						onShare={handleShareChat}
						onRename={handleRenameChat}
						onDelete={handleDeleteChat}
						onMoveToFolder={currentChatId ? handleMoveToFolder : undefined}
					/>

					{isOfflineCloud && <OfflineBanner />}

					{setupError && !isOfflineCloud && (
						<View
							style={{
								padding: 8,
								backgroundColor: "rgba(255,60,60,0.15)",
							}}
						>
							<Text style={{ fontSize: 12, textAlign: "center" }}>
								Provider setup failed. Check settings.
							</Text>
						</View>
					)}

					{showTruncationWarning && (
						<View
							style={{
								padding: 8,
								backgroundColor: "rgba(255,200,0,0.2)",
							}}
						>
							<Text style={{ fontSize: 12, textAlign: "center" }}>
								Long chat - start a new one for best results.
							</Text>
						</View>
					)}

					<View style={{ flex: 1 }}>
						{messages.length === 0 && !currentChatId && (
							<View
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									bottom: 60,
									zIndex: 0,
								}}
							>
								<SuggestionCards onSuggestionPress={handleSuggestionPress} />
							</View>
						)}
						<GiftedChat
							key={currentChatId || "new-chat"}
							messages={[
								...(isAiTyping && !streamingText
									? [
											{
												_id: "typing-indicator",
												text: "",
												user: { _id: 2, name: "AI" },
												providerId: activeProvider?.id,
											} as unknown as IMessage,
										]
									: []),
								...(isAiTyping && streamingText && !isContinuing
									? [
											{
												_id: "streaming",
												text: streamingText,
												user: { _id: 2, name: "AI" },
												providerId: activeProvider?.id,
											} as unknown as IMessage,
										]
									: []),
								...(!isAiTyping &&
								lastAssistantStatus &&
								lastAssistantStatus !== "done"
									? [
											{
												_id: "status-notice",
												text: "",
												user: { _id: 2, name: "AI" },
												providerId: activeProvider?.id,
											} as unknown as IMessage,
										]
									: []),
								...messages.map(
									(message, index) =>
										({
											_id: message._id,
											text:
												isContinuing &&
												streamingText &&
												index === 0 &&
												message.user._id === 2
													? `${message.text}\n\n${streamingText}`
													: message.text,
											user: message.user,
											providerId: message.providerId,
											modelId: message.modelId,
											attachments: message.attachments,
										}) as unknown as IMessage,
								),
							]}
							onSend={(msgs) => onSend(msgs)}
							user={{ _id: 1 }}
							renderAvatar={renderAvatar}
							renderAvatarOnTop
							alwaysShowSend
							isTyping={false}
							bottomOffset={0}
							minInputToolbarHeight={0}
							renderBubble={renderBubble}
							renderInputToolbar={renderInputToolbar}
							messagesContainerStyle={defaultContainerStyle}
							keyboardShouldPersistTaps="handled"
							inverted={true}
						/>
					</View>
				</View>
			</SafeAreaView>
			<InputToolbar
				text={inputText}
				onChangeText={setInputText}
				canSend={
					!!(inputText.trim() || attachments.length > 0) &&
					!recorderState.isRecording &&
					!isProcessingMedia &&
					!isAiTyping &&
					!isTranscribing
				}
				onSend={() => {
					if (
						(inputText.trim() || attachments.length > 0) &&
						!recorderState.isRecording &&
						!isProcessingMedia &&
						!isAiTyping &&
						!isTranscribing
					) {
						onSend([{ text: inputText.trim() } as IMessage]);
					}
				}}
				topAccessory={
					<>
						{recorderState.isRecording && (
							<AudioRecorderOverlay
								isRecording={recorderState.isRecording}
								durationMs={recorderState.durationMs}
								onSend={handleSendRecording}
								onCancel={cancelRecording}
							/>
						)}
						{attachments.length > 0 && !recorderState.isRecording && (
							<AttachmentPreview
								attachments={attachments}
								onRemove={removeAttachment}
								isCloudProvider={isCloudProvider}
							/>
						)}
						{(isTranscribing || isProcessingMedia) && (
							<RNView
								style={{
									flexDirection: "row",
									alignItems: "center",
									paddingHorizontal: 16,
									paddingVertical: 6,
									gap: 8,
								}}
							>
								<ActivityIndicator size="small" color={theme.tint} />
								<Text style={{ fontSize: 13, color: theme.mutedForeground }}>
									{isProcessingMedia
										? "Processing media..."
										: "Transcribing audio..."}
								</Text>
							</RNView>
						)}
					</>
				}
				leftAccessory={
					!recorderState.isRecording ? (
						<AttachmentButton
							capabilities={multimodalCaps}
							canAddImage={canAddImage}
							disabled={isAiTyping}
							onImageSelected={addImageAttachment}
						/>
					) : null
				}
				rightAccessory={
					!recorderState.isRecording && !isTranscribing ? (
						<RNView style={{ flexDirection: "row", alignItems: "center" }}>
							{multimodalCaps.vision && (
								<TouchableOpacity
									onPress={handleTakePhoto}
									style={{ padding: 8 }}
									activeOpacity={0.6}
								>
									<Camera size={22} color={theme.text} strokeWidth={2} />
								</TouchableOpacity>
							)}
							{multimodalCaps.audio && canAddAudio && (
								<TouchableOpacity
									onPress={startRecording}
									style={{ padding: 8 }}
									activeOpacity={0.6}
								>
									<Mic size={22} color={theme.text} strokeWidth={2} />
								</TouchableOpacity>
							)}
						</RNView>
					) : null
				}
			/>
			{currentChatId && (
				<MoveToFolderSheet
					open={moveToFolderSheetOpen}
					onOpenChange={setMoveToFolderSheetOpen}
					chatId={currentChatId}
					currentFolderId={currentChatFolderId}
					folders={foldersWithCounts}
					onMoved={() => {}}
				/>
			)}

			<PromptDialog
				visible={renamePromptVisible}
				title="Rename Chat"
				message="Enter a new name for this chat"
				placeholder="Chat name"
				defaultValue={chatRow.name as string}
				confirmText="Rename"
				onConfirm={handleConfirmRename}
				onCancel={() => setRenamePromptVisible(false)}
			/>

			<ImageViewer
				visible={!!viewerImageUri}
				uri={viewerImageUri || ""}
				onClose={handleCloseViewer}
			/>
		</RNView>
	);
}
