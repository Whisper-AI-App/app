# Architecture

This document describes the high-level architecture of the Whisper app.

## State Management (TinyBase)

The entire app state is managed through a TinyBase store (`src/store.ts`) with a strongly-typed schema.

### Values

Singleton key-value pairs used for settings, onboarding status, and AI model metadata. Examples include `onboardedAt`, `ai_chat_model_fileUri`, `ai_chat_model_downloadedAt`, `ai_chat_model_progressSizeGB`, and `ai_chat_model_totalSizeGB`.

### Tables

- **chats**: Chat sessions with `id`, `name`, and `createdAt` fields.
- **messages**: Individual messages linked to chats via a `chatId` foreign key.

### Persistence

The store persists automatically to `whisper.json` in the document directory via `createExpoFileSystemPersister`. Changes are written to disk in the background without blocking the UI thread.

## Actions Pattern

Business logic is organized into action functions in `src/actions/`:

- `settings.ts` -- User preferences and onboarding
- `chat.ts` -- Chat CRUD operations
- `message.ts` -- Message operations
- `ai-chat-model.ts` -- LLM download, pause/resume, and lifecycle management
- `reset.ts` -- Factory reset functionality

Actions mutate the TinyBase store directly. Components subscribe to store changes via TinyBase React hooks (`useValue`, `useRow`, etc.) and remain mostly stateless.

## AI Model Management

AI model handling spans three layers.

### Download Layer

Located in `src/actions/ai-chat-model.ts`.

- Downloads GGUF model files from HuggingFace.
- Supports pause and resume with state serialization.
- Tracks download progress in TinyBase values: `ai_chat_model_progressSizeGB` and `ai_chat_model_totalSizeGB`.
- Stores resumable download state so interrupted downloads can continue from where they left off.

### Context Layer

Located in `contexts/AIChatContext.tsx`.

- Wraps llama.rn initialization and inference.
- Provides `loadModel()` to initialize from a downloaded GGUF file.
- Provides `completion()` for streaming chat completions.
- Maintains a single `LlamaContext` instance. Loading a second model without releasing the first throws an error.

### Integration

The dashboard screen ties both layers together:

- Automatically loads the model on mount if it has been downloaded but not yet loaded.
- Listens to `ai_chat_model_downloadedAt` and `ai_chat_model_fileUri` values to detect when a model becomes available.

## App Flow

1. **Onboarding** (`app/index.tsx`): Multi-step onboarding flow with steps defined in `components/flows/onboarding-steps.tsx`.
2. **Download** (`app/download.tsx`): Downloads the default AI model (Qwen3 0.6B Q4_0) with pause/resume support.
3. **Dashboard** (`app/dashboard.tsx`): Main chat interface with search bar, settings, and chat list.

Navigation uses Expo Router's `useRouter()` with `router.replace()` for flow progression, so users cannot navigate backward to completed steps.

## Component Organization

- `components/ui/` -- Reusable UI primitives from the BNA UI library (Button, Text, View, Sheet, Progress, etc.).
- `components/` -- Feature-specific components (Chat, ChatPreview, Logo, StatusBar).
- `components/flows/` -- Multi-step flows like onboarding.

## Theme System

The custom theme system is located in `theme/` and consists of:

- `theme-provider.tsx` -- Theme context provider.
- `colors.ts` -- Color token definitions.
- `globals.ts` -- Global style definitions.

Components access theme values through hooks:

- `useColor()` -- Returns the current color tokens.
- `useColorScheme()` -- Returns the current color scheme (light or dark).

Light and dark modes are supported, with a `ModeToggle` component for switching between them.

## Resumable Downloads

Downloads use Expo's `createDownloadResumable` API with state serialization. The pattern is:

1. Store the resumable download state in TinyBase when pausing.
2. Deserialize and recreate the `DownloadResumable` instance when resuming.
3. Track the single active download in a module-level variable to prevent concurrent downloads.

## Model Loading

Models must be loaded into memory before they can be used for inference. The context layer maintains a single `LlamaContext` instance at a time. Attempting to load a second model without first releasing the current one will throw an error.
