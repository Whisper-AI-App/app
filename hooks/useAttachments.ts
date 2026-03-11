import { useCallback, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { PendingAttachment } from "@/src/ai-providers/types";

const MAX_IMAGE_FILE_ATTACHMENTS = 5;
const MAX_AUDIO_ATTACHMENTS = 1;

export interface UseAttachmentsReturn {
	attachments: PendingAttachment[];
	addImageAttachment: (
		uri: string,
		mimeType: string,
		width?: number,
		height?: number,
		fileName?: string,
		fileSize?: number,
	) => void;
	addFileAttachment: (
		uri: string,
		mimeType: string,
		fileName: string,
		fileSize: number,
	) => void;
	addAudioAttachment: (
		uri: string,
		mimeType: string,
		fileName: string,
		fileSize: number,
		duration?: number,
	) => string;
	updateAttachment: (id: string, updates: Partial<PendingAttachment>) => void;
	removeAttachment: (id: string) => void;
	clearAttachments: () => void;
	canAddImage: boolean;
	canAddFile: boolean;
	canAddAudio: boolean;
}

export function useAttachments(): UseAttachmentsReturn {
	const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

	const imageFileCount = attachments.filter(
		(a) => a.type === "image" || a.type === "file",
	).length;
	const audioCount = attachments.filter((a) => a.type === "audio").length;

	const canAddImage = imageFileCount < MAX_IMAGE_FILE_ATTACHMENTS;
	const canAddFile = imageFileCount < MAX_IMAGE_FILE_ATTACHMENTS;
	const canAddAudio = audioCount < MAX_AUDIO_ATTACHMENTS;

	const addImageAttachment = useCallback(
		(
			uri: string,
			mimeType: string,
			width?: number,
			height?: number,
			fileName?: string,
			fileSize?: number,
		) => {
			setAttachments((prev) => {
				const currentCount = prev.filter(
					(a) => a.type === "image" || a.type === "file",
				).length;
				if (currentCount >= MAX_IMAGE_FILE_ATTACHMENTS) return prev;

				return [
					...prev,
					{
						id: uuidv4(),
						type: "image",
						uri,
						mimeType,
						fileName: fileName ?? `photo_${Date.now()}.jpg`,
						fileSize: fileSize ?? 0,
						width,
						height,
					},
				];
			});
		},
		[],
	);

	const addFileAttachment = useCallback(
		(uri: string, mimeType: string, fileName: string, fileSize: number) => {
			setAttachments((prev) => {
				const currentCount = prev.filter(
					(a) => a.type === "image" || a.type === "file",
				).length;
				if (currentCount >= MAX_IMAGE_FILE_ATTACHMENTS) return prev;

				return [
					...prev,
					{
						id: uuidv4(),
						type: "file",
						uri,
						mimeType,
						fileName,
						fileSize,
					},
				];
			});
		},
		[],
	);

	const addAudioAttachment = useCallback(
		(
			uri: string,
			mimeType: string,
			fileName: string,
			fileSize: number,
			duration?: number,
		): string => {
			const id = uuidv4();
			setAttachments((prev) => {
				const currentCount = prev.filter((a) => a.type === "audio").length;
				if (currentCount >= MAX_AUDIO_ATTACHMENTS) return prev;

				return [
					...prev,
					{
						id,
						type: "audio",
						uri,
						mimeType,
						fileName,
						fileSize,
						duration,
					},
				];
			});
			return id;
		},
		[],
	);

	const updateAttachment = useCallback(
		(id: string, updates: Partial<PendingAttachment>) => {
			setAttachments((prev) =>
				prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
			);
		},
		[],
	);

	const removeAttachment = useCallback((id: string) => {
		setAttachments((prev) => prev.filter((a) => a.id !== id));
	}, []);

	const clearAttachments = useCallback(() => {
		setAttachments([]);
	}, []);

	return {
		attachments,
		addImageAttachment,
		addFileAttachment,
		addAudioAttachment,
		updateAttachment,
		removeAttachment,
		clearAttachments,
		canAddImage,
		canAddFile,
		canAddAudio,
	};
}
