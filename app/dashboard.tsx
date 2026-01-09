import { ChatPreview } from "@/components/chat-preview";
import { ModelLoadError } from "@/components/model-load-error";
import { ModelUpdateNotification } from "@/components/model-update-notification";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SearchBar } from "@/components/ui/searchbar";
import { SearchButton } from "@/components/ui/searchbutton";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIChat } from "@/contexts/AIChatContext";
import { useColor } from "@/hooks/useColor";
import {
  checkForModelUpdates,
  type ModelUpdateInfo,
} from "@/src/actions/ai-chat-model";
import { getModelFileUri } from "@/src/store";
import { Colors } from "@/theme/colors";
import { ImageBackground } from "expo-image";
import { useRouter } from "expo-router";
import { Hand, MessageCircle, Settings } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Dimensions, Linking, Pressable, useColorScheme } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Defs, RadialGradient, Rect, Stop, Svg } from "react-native-svg";

import {
  useRowIds,
  useSortedRowIds,
  useTable,
  useValue,
} from "tinybase/ui-react";

export default function Dashboard() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const backgroundColor = useColor("background");
  const scrollY = useSharedValue(0);

  // Gradient animation - animate opacity of bright overlay
  const gradientOpacity = useSharedValue(0);

  useEffect(() => {
    gradientOpacity.value = withRepeat(
      withTiming(1, {
        duration: 6000,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
  }, []);

  const animatedGradientStyle = useAnimatedStyle(() => ({
    opacity: gradientOpacity.value,
  }));

  const router = useRouter();
  const muted = useColor("textMuted");

  const [searchQuery, setSearchQuery] = useState("");
  const [modelLoadError, setModelLoadError] = useState(false);
  const [updateNotificationVisible, setUpdateNotificationVisible] =
    useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<ModelUpdateInfo | null>(null);

  const aiChat = useAIChat();

  // Check for completed model using useValue
  const downloadedAt = useValue("ai_chat_model_downloadedAt") as
    | string
    | undefined;
  // Use filename (not full path) to detect changes, then reconstruct full path
  const filename = useValue("ai_chat_model_filename") as string | undefined;
  const storedConfigVersion = useValue("ai_chat_model_config_version") as
    | string
    | undefined;

  // Get all chat IDs sorted by creation date (newest first)
  const chatIds = useSortedRowIds("chats", "createdAt", true);

  // Get all message IDs to find latest message for each chat
  const messageIds = useRowIds("messages");

  // Subscribe to the entire chats and messages tables to trigger re-render when any data changes
  const chatsTable = useTable("chats");
  const messagesTable = useTable("messages");

  // Create a map of chatId -> latest message for preview
  const chatPreviews = useMemo(() => {
    const allPreviews = chatIds.map((chatId) => {
      const chat = chatsTable[chatId];

      // Find the latest message for this chat
      const chatMessages = messageIds
        .map((id) => messagesTable[id])
        .filter((msg) => msg?.chatId === chatId)
        .sort(
          (a, b) =>
            new Date(b?.createdAt ? String(b?.createdAt) : 0).getTime() -
            new Date(a?.createdAt ? String(a?.createdAt) : 0).getTime()
        );

      const latestMessage = chatMessages[0];

      return {
        chatId,
        name: String(chat?.name || "Untitled Chat"),
        text: String(latestMessage?.contents || "No messages yet"),
        date: new Date(chat?.createdAt ? String(chat.createdAt) : Date.now()),
      };
    });

    // Filter based on search query
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allPreviews;
    }

    return allPreviews.filter((preview) => {
      const nameMatch = String(preview.name).toLowerCase().includes(query);
      const textMatch = String(preview.text).toLowerCase().includes(query);
      return nameMatch || textMatch;
    });
  }, [chatIds, messageIds, searchQuery, chatsTable, messagesTable]);

  // Check for completed model on mount and load it if available
  useEffect(() => {
    if (downloadedAt && filename && !aiChat.isLoaded && !modelLoadError) {
      // Reconstruct full path from filename (handles app updates changing paths)
      const fileUri = getModelFileUri();
      if (!fileUri) return;

      // Model is downloaded but not loaded yet, load it
      console.log("[Dashboard] Loading model from:", fileUri);
      aiChat
        .loadModel({ ggufPath: fileUri })
        .then(() => {
          console.log("[Dashboard] Model loaded successfully");
          setModelLoadError(false);
        })
        .catch((error) => {
          console.error("[Dashboard] Failed to load model:", error);
          setModelLoadError(true);
        });
    }
  }, [downloadedAt, filename, aiChat, modelLoadError]);

  // Function to retry loading the model
  const retryLoadModel = () => {
    setModelLoadError(false);
  };

  // Animated scroll handler
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Greeting animation style
  const greetingAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 48],
      [1, 0],
      Extrapolation.CLAMP
    );

    const targetTranslateY = interpolate(
      scrollY.value,
      [0, 48],
      [0, -32],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [
        {
          translateY: withSpring(targetTranslateY, {
            damping: 30,
            stiffness: 250,
            mass: 0.3,
            overshootClamping: false,
          }),
        },
      ],
    };
  });

  // Check for model updates after model is loaded
  useEffect(() => {
    console.log("[Dashboard] Update check conditions:", {
      downloadedAt: !!downloadedAt,
      isLoaded: aiChat.isLoaded,
      storedConfigVersion,
    });

    if (!downloadedAt || !aiChat.isLoaded || !storedConfigVersion) {
      return;
    }

    const checkForUpdates = async () => {
      try {
        const updateInfo = await checkForModelUpdates();

        if (updateInfo.hasUpdate) {
          console.log(
            "[Dashboard] Update available:",
            updateInfo.requiresDownload ? "download required" : "metadata only",
            `(${updateInfo.reason})`
          );
          setUpdateInfo(updateInfo);
          setUpdateAvailable(true);
          setUpdateNotificationVisible(true);
        } else {
          console.log("[Dashboard] No update available");
        }
      } catch (error) {
        console.error("[Dashboard] Failed to check for updates:", error);
      }
    };

    // Check for updates with a small delay to not interfere with model loading
    const timeout = setTimeout(checkForUpdates, 2000);
    return () => clearTimeout(timeout);
  }, [downloadedAt, aiChat.isLoaded, storedConfigVersion]);

  // SVG gradient styles
  const svgStyle = useMemo(
    () => ({
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: "100%" as const,
      height: Dimensions.get("window").height,
    }),
    []
  );

  const svgViewBox = useMemo(
    () =>
      `0 0 1 ${
        Dimensions.get("window").height / Dimensions.get("window").width
      }`,
    []
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Background gradient layer - base (dim) */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <Svg style={svgStyle} viewBox={svgViewBox}>
          <Defs>
            <RadialGradient
              id="radialGradientBase"
              gradientUnits="objectBoundingBox"
              cx={0.5}
              cy={0.5}
              r={0.75}
            >
              <Stop offset="0" stopColor="#ff5b91ff" stopOpacity={0.05} />
              <Stop offset="0.15" stopColor="#ff5b91ff" stopOpacity={0.05} />
              <Stop offset="0.2" stopColor="#ff95ffff" stopOpacity={0.025} />
              <Stop offset="0.25" stopColor="#69b7ffff" stopOpacity={0.0125} />
              <Stop offset="0.3" stopColor={theme.card} stopOpacity={0} />
              <Stop offset="0.4" stopColor={theme.background} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect
            x={-1.5}
            y={0.125}
            width="4"
            height="4"
            fill="url(#radialGradientBase)"
          />
        </Svg>
      </View>

      {/* Background gradient layer - bright overlay (animated opacity) */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          },
          animatedGradientStyle,
        ]}
      >
        <Svg style={svgStyle} viewBox={svgViewBox}>
          <Defs>
            <RadialGradient
              id="radialGradientBright"
              gradientUnits="objectBoundingBox"
              cx={0.5}
              cy={0.5}
              r={0.75}
            >
              <Stop offset="0" stopColor="#ff5b91ff" stopOpacity={0.2} />
              <Stop offset="0.15" stopColor="#ff5b91ff" stopOpacity={0.16} />
              <Stop offset="0.2" stopColor="#ff95ffff" stopOpacity={0.1} />
              <Stop offset="0.25" stopColor="#69b7ffff" stopOpacity={0.05} />
              <Stop offset="0.3" stopColor={theme.card} stopOpacity={0} />
              <Stop offset="0.4" stopColor={theme.background} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect
            x={-1.5}
            y={0.125}
            width="4"
            height="4"
            fill="url(#radialGradientBright)"
          />
        </Svg>
      </Animated.View>

      {/* Grain texture overlay */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
        pointerEvents="none"
      >
        <ImageBackground
          source={
            colorScheme === "dark"
              ? require(`../assets/images/grain-dark.png`)
              : require(`../assets/images/grain.png`)
          }
          style={{
            flex: 1,
            opacity: 0.2,
            backgroundColor: backgroundColor,
          }}
        />
      </View>

      <SafeAreaView edges={["right", "top", "left"]} style={{ flex: 1 }}>
        <View
          style={{
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
            padding: 16,
            gap: 16,
            borderBottomColor: "rgba(125,125,125,0.15)",
            borderBottomWidth: 1,
          }}
        >
          <SearchBar
            placeholder="Search for anything..."
            onSearch={setSearchQuery}
            loading={false}
            containerStyle={{ flex: 1 }}
          />

          <Button
            onPress={() => router.push("/settings")}
            variant="ghost"
            size="icon"
            style={{ backgroundColor: theme.accent }}
          >
            <Settings color={theme.textMuted} strokeWidth={2} size={20} />
          </Button>
        </View>

        {modelLoadError && <ModelLoadError onRetry={retryLoadModel} />}

        {/* Update Available Banner */}
        {updateAvailable && !updateNotificationVisible && updateInfo && (
          <View
            style={{
              backgroundColor: theme.green,
              paddingVertical: 8,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  marginBottom: 1,
                  color: theme.secondary,
                }}
              >
                {updateInfo.requiresDownload
                  ? "AI Update Available"
                  : "AI Updated!"}
              </Text>
              <Text
                style={{ fontSize: 12, opacity: 0.9, color: theme.secondary }}
              >
                {updateInfo.requiresDownload
                  ? "New version ready to download"
                  : "Tap to see what's new"}
              </Text>
            </View>
            <View>
              <Button
                size="sm"
                onPress={() => setUpdateNotificationVisible(true)}
                style={{ paddingHorizontal: 24 }}
                textStyle={{ fontSize: 14 }}
                variant="secondary"
              >
                View
              </Button>
            </View>
          </View>
        )}

        {chatPreviews.length > 0 && (
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 128 + 40,
                left: 0,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",

                gap: 1,
                paddingHorizontal: 20,
                zIndex: 10,
              },
              greetingAnimatedStyle,
            ]}
          >
            <View
              style={{
                display: "flex",
                alignItems: "center",
                flexDirection: "row",
                gap: 6,
                opacity: 0.75,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "500" }}>
                {new Date().getHours() < 5
                  ? "Good night"
                  : new Date().getHours() < 12
                  ? "Good morning"
                  : new Date().getHours() < 17
                  ? "Good afternoon"
                  : new Date().getHours() < 21
                  ? "Good evening"
                  : "Good evening"}
              </Text>
              <Hand
                color={theme.text}
                width={16}
                strokeWidth={2}
                style={{
                  width: 8,
                  height: 8,
                  transform: [{ rotate: "40deg" }],
                }}
              />
            </View>

            <View
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 12,
                paddingVertical: 6,
              }}
            >
              <Pressable
                onPress={() => Linking.openURL("https://usewhisper.org/news")}
              >
                <Text
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingBottom: 0.05,
                    borderBottomColor: "rgba(150,150,150,0.25)",
                    borderBottomWidth: 2,
                    fontSize: 12,
                    color: theme.textMuted,
                  }}
                >
                  Latest updates
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  Linking.openURL("https://usewhisper.org/chat-with-us")
                }
              >
                <Text
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingBottom: 0.05,
                    borderBottomColor: "rgba(150,150,150,0.25)",
                    borderBottomWidth: 2,
                    fontSize: 12,
                    color: theme.textMuted,
                  }}
                >
                  Request feature
                </Text>
              </Pressable>
            </View>

            {chatPreviews.length > 0 && (
              <Text style={{ fontSize: 12, opacity: 0.5 }}>
                You have {chatPreviews.length} chat
                {chatPreviews.length > 1 && "s"}
              </Text>
            )}
          </Animated.View>
        )}

        <Animated.ScrollView
          style={{
            position: "relative",
            flex: 1,
            paddingHorizontal: 16,
          }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {chatPreviews.length > 0 ? (
            chatPreviews.map((preview, index, array) => {
              const previewWrapper = (
                <View
                  key={preview.chatId}
                  style={{
                    paddingBottom: index >= array.length - 1 ? 160 : 0,
                    paddingTop: index === 0 ? 148 : 16,
                  }}
                >
                  <ChatPreview
                    chatId={preview.chatId}
                    date={preview.date}
                    name={preview.name}
                    text={preview.text}
                    onPress={() => {
                      router.push(`/chat?id=${preview.chatId}`);
                    }}
                  />
                </View>
              );

              return <View key={preview.chatId}>{previewWrapper}</View>;
            })
          ) : (
            <View style={{ padding: 32, alignItems: "center", gap: 16 }}>
              <Text
                style={{
                  opacity: 0.75,
                  fontSize: searchQuery.trim() ? 16 : 14,
                }}
              >
                {searchQuery.trim() ? "No chats found" : "No chats yet"}
              </Text>
              {!searchQuery.trim() && (
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() => {
                    router.push("/chat");
                  }}
                >
                  Start a conversation
                </Button>
              )}

              <View
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 12,
                  paddingVertical: 6,
                  opacity: 0.5,
                }}
              >
                <Pressable
                  onPress={() => Linking.openURL("https://usewhisper.org/news")}
                >
                  <Text
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      paddingBottom: 0.05,
                      borderBottomColor: "rgba(150,150,150,0.25)",
                      borderBottomWidth: 2,
                      fontSize: 12,
                      color: theme.textMuted,
                    }}
                  >
                    Latest news
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Linking.openURL("https://usewhisper.org/chat-with-us")
                  }
                >
                  <Text
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      paddingBottom: 0.05,
                      borderBottomColor: "rgba(150,150,150,0.25)",
                      borderBottomWidth: 2,
                      fontSize: 12,
                      color: theme.textMuted,
                    }}
                  >
                    Report problem
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </Animated.ScrollView>

        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            paddingHorizontal: 16,
            paddingBottom: 56,
          }}
        >
          <View style={{ borderRadius: 24, boxShadow: "0 0 5px pink" }}>
            <SearchButton
              label="Chat..."
              leftIcon={<Icon name={MessageCircle} size={16} color={muted} />}
              loading={false}
              onPress={() => {
                router.push("/chat");
              }}
            />
          </View>
        </View>

        {/* Model Update Notification */}
        {updateInfo && (
          <ModelUpdateNotification
            isVisible={updateNotificationVisible}
            onClose={() => {
              setUpdateNotificationVisible(false);
              // If it's just metadata update, dismiss permanently
              if (!updateInfo.requiresDownload) {
                setUpdateAvailable(false);
              }
              // If download required, keep banner visible
            }}
            currentCard={updateInfo.currentCard}
            newCard={updateInfo.newCard}
            currentVersion={updateInfo.currentVersion ?? ""}
            newVersion={updateInfo.newVersion}
            requiresDownload={updateInfo.requiresDownload}
          />
        )}
      </SafeAreaView>
    </View>
  );
}
