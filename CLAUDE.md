# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whisper is a 100% private AI chat application built with React Native and Expo. It runs Large Language Models (LLMs) entirely on-device using llama.rn, ensuring complete privacy by keeping all conversations local.

## Tech Stack

- **Framework**: Expo (React Native)
- **Routing**: Expo Router (file-based routing in `app/` directory)
- **State Management**: TinyBase with typed schemas
- **Persistence**: Expo FileSystem with TinyBase persister (https://github.com/Mote-Software/tinybase-persister-expo-file-system)
- **AI/ML**: llama.rn for on-device LLM inference
- **UI**: Custom BNA UI components in `components/ui/` (https://ui.ahmedbna.com/docs/components)
- **Styling**: React Native StyleSheet with custom theme system

## Key Commands

```bash
# Install dependencies
pnpm install

# Run on specific platforms
pnpm android
pnpm ios

# Lint
pnpm lint
```

## Architecture

### State Management (TinyBase)

The entire app state is managed through TinyBase store (`src/store.ts`) with a strongly-typed schema:

- **Values**: Singleton key-value pairs for settings, onboarding status, and AI model metadata
- **Tables**:
  - `chats`: Chat sessions with id, name, createdAt
  - `messages`: Individual messages linked to chats via chatId

The store persists automatically to `whisper.json` in the document directory via `createExpoFileSystemPersister`.

### Actions Pattern

Business logic is organized into action functions in `src/actions/`:
- `settings.ts`: User preferences and onboarding
- `chat.ts`: Chat CRUD operations
- `message.ts`: Message operations
- `ai-chat-model.ts`: LLM download, pause/resume, and lifecycle management
- `reset.ts`: Factory reset functionality

Actions mutate the TinyBase store directly. Components subscribe to store changes via TinyBase React hooks (`useValue`, `useRow`, etc.).

### AI Model Management

AI model handling spans multiple layers:

1. **Download Layer** (`src/actions/ai-chat-model.ts`):
   - Downloads GGUF models from HuggingFace
   - Supports pause/resume with state serialization
   - Tracks progress in TinyBase values: `ai_chat_model_progressSizeGB`, `ai_chat_model_totalSizeGB`
   - Stores resumable state for interrupted downloads

2. **Context Layer** (`contexts/AIChatContext.tsx`):
   - Wraps llama.rn initialization and inference
   - Provides `loadModel()` to initialize from downloaded GGUF file
   - Provides `completion()` for streaming chat completions
   - Maintains single LlamaContext instance

3. **Integration** (Dashboard screen):
   - Automatically loads model on mount if downloaded but not loaded
   - Listens to `ai_chat_model_downloadedAt` and `ai_chat_model_fileUri` values

### App Flow

1. **Index (`app/index.tsx`)**: Onboarding screen with steps defined in `components/flows/onboarding-steps.tsx`
2. **Download (`app/download.tsx`)**: Downloads default AI model (Qwen3 0.6B Q4_0) with pause/resume support
3. **Dashboard (`app/dashboard.tsx`)**: Main chat interface with search bar, settings, and chat list

Navigation uses Expo Router's `useRouter()` with `router.replace()` for flow progression.

### Component Organization

- `components/ui/`: Reusable UI primitives (Button, Text, View, Sheet, Progress, etc.)
- `components/`: Feature-specific components (Chat, ChatPreview, Logo, StatusBar)
- `components/flows/`: Multi-step flows like onboarding

### Theme System

Custom theme provider (`theme/theme-provider.tsx`) with:
- Color tokens in `theme/colors.ts`
- Global styles in `theme/globals.ts`
- Hook-based access: `useColor()`, `useColorScheme()`
- Supports light/dark modes with `ModeToggle` component

## Important Patterns

### TinyBase Subscriptions

Components subscribe to store updates using TinyBase React hooks:

```typescript
const onboardedAt = useValue('onboardedAt');
const chat = useRow('chats', chatId);
```

These automatically re-render when values change. No manual subscription management needed.

### Resumable Downloads

Downloads use Expo's legacy `createDownloadResumable` API with state serialization. The pattern:
1. Store resumable state in TinyBase when pausing
2. Deserialize and recreate `DownloadResumable` when resuming
3. Track single active download in module-level variable

### Model Loading

Models must be loaded before use. The context maintains a single LlamaContext instance. Loading a second model without releasing throws an error.

## File Structure Conventions

- `app/`: File-based routes (index, dashboard, download)
- `src/actions/`: State mutation functions
- `src/utils/`: Pure utility functions
- `contexts/`: React Context providers
- `components/`: React components
- `theme/`: Theming system
- `hooks/`: Custom React hooks

## Testing & Development

Currently no test runner configured. Linting via `npm run lint` using ESLint with Expo config.

When developing features, consider:
- All state changes go through actions that mutate TinyBase store
- UI components read from store via hooks and remain mostly stateless
- Large downloads should use pause/resume pattern with state serialization
- Model operations (load, completion) go through AIChatContext
