import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import { AlertTriangle, RefreshCw } from "lucide-react-native";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
	onReset?: () => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in its child component tree.
 * Displays a fallback UI when an error occurs and provides a retry mechanism.
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		if (__DEV__) {
			console.error("[ErrorBoundary] Caught error:", error);
			console.error(
				"[ErrorBoundary] Component stack:",
				errorInfo.componentStack,
			);
		}
		this.props.onError?.(error, errorInfo);
	}

	handleReset = (): void => {
		this.setState({ hasError: false, error: null });
		this.props.onReset?.();
	};

	render(): ReactNode {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<ErrorFallback error={this.state.error} onReset={this.handleReset} />
			);
		}

		return this.props.children;
	}
}

interface ErrorFallbackProps {
	error: Error | null;
	onReset?: () => void;
	title?: string;
	message?: string;
}

/**
 * Default fallback UI displayed when an error is caught.
 * Can be used standalone or as part of ErrorBoundary.
 */
function ErrorFallback({
	error,
	onReset,
	title = "Something went wrong",
	message = "An unexpected error occurred. Please try again.",
}: ErrorFallbackProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<SafeAreaView
			style={{
				flex: 1,
				backgroundColor: theme.background,
			}}
		>
			<View
				style={{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					paddingHorizontal: 32,
				}}
			>
				<View
					style={{
						width: 80,
						height: 80,
						borderRadius: 40,
						backgroundColor: `${theme.destructive}20`,
						justifyContent: "center",
						alignItems: "center",
						marginBottom: 24,
					}}
				>
					<AlertTriangle
						color={theme.destructive}
						size={40}
						strokeWidth={1.5}
					/>
				</View>

				<Text
					style={{
						fontSize: 22,
						fontWeight: "600",
						textAlign: "center",
						marginBottom: 12,
					}}
				>
					{title}
				</Text>

				<Text
					style={{
						fontSize: 15,
						color: theme.textMuted,
						textAlign: "center",
						marginBottom: 24,
						lineHeight: 22,
					}}
				>
					{message}
				</Text>

				{__DEV__ && error && (
					<View
						style={{
							backgroundColor: theme.card,
							borderRadius: BORDER_RADIUS / 2,
							padding: 16,
							marginBottom: 24,
							width: "100%",
						}}
					>
						<Text
							style={{
								fontSize: 12,
								fontWeight: "600",
								color: theme.destructive,
								marginBottom: 8,
							}}
						>
							Error Details (Dev Mode Only)
						</Text>
						<Text
							style={{
								fontSize: 11,
								color: theme.textMuted,
								fontFamily: "monospace",
							}}
							numberOfLines={5}
						>
							{error.message}
						</Text>
					</View>
				)}

				{onReset && (
					<Button variant="secondary" onPress={onReset} icon={RefreshCw}>
						Try Again
					</Button>
				)}
			</View>
		</SafeAreaView>
	);
}

/**
 * Compact error fallback for use in smaller UI areas (e.g., within a screen section).
 */
function CompactErrorFallback({
	error: _error,
	onReset,
	message = "Something went wrong",
}: ErrorFallbackProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				alignItems: "center",
				padding: 24,
			}}
		>
			<AlertTriangle color={theme.destructive} size={32} strokeWidth={1.5} />
			<Text
				style={{
					fontSize: 15,
					color: theme.textMuted,
					textAlign: "center",
					marginTop: 12,
					marginBottom: 16,
				}}
			>
				{message}
			</Text>
			{onReset && (
				<Button variant="ghost" size="sm" onPress={onReset} icon={RefreshCw}>
					Retry
				</Button>
			)}
		</View>
	);
}
