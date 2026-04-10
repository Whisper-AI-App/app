import { HuggingFaceDownloadScreen } from "@/components/provider-setup/HuggingFaceDownloadScreen";
import { useLocalSearchParams } from "expo-router";

export default function HuggingFaceDownload() {
	const { modelId } = useLocalSearchParams<{ modelId: string }>();
	return <HuggingFaceDownloadScreen modelId={modelId} />;
}
