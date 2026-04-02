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
# Install dependencies (run on fresh clone or new git worktree)
npm install

# Run on specific platforms
npm run android
npm run ios

# Lint
npm run lint
```

### Git worktrees

After entering a worktree:

1. Install deps `npm ci`
2. Upsert a new `RCT_METRO_PORT` to `.env.local` with `PORT=80$(shuf -i 10-99 -n1) && if grep -q '^RCT_METRO_PORT=' .env.local 2>/dev/null; then sed -i '' "s/^RCT_METRO_PORT=.*/RCT_METRO_PORT=$PORT/" .env.local; else echo "RCT_METRO_PORT=$PORT" >> .env.local; fi` (avoid collision with other worktrees)

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

### TinyBase ui-react Hooks Reference

TinyBase provides a comprehensive set of React hooks in the `tinybase/ui-react` package that automatically subscribe to store changes and trigger re-renders. All hooks handle lifecycle management automatically - listeners are registered on mount and cleaned up on unmount.

#### Reading Data (Auto-subscribing hooks)

**Values:**
- `useValue(valueId)` - Returns a single value and re-renders on change
- `useValues()` - Returns all values object
- `useValueIds()` - Returns array of all value IDs

**Tables & Rows:**
- `useTable(tableId)` - Returns entire table object with all rows
- `useTables()` - Returns all tables
- `useTableIds()` - Returns array of table IDs
- `useRow(tableId, rowId)` - Returns single row object (all cells in that row)
- `useRowIds(tableId)` - Returns array of row IDs for a table
- `useSortedRowIds(tableId, cellId, descending, offset, limit)` - Returns sorted/paginated row IDs (useful for lists sorted by date, etc.)

**Cells:**
- `useCell(tableId, rowId, cellId)` - Returns single cell value
- `useCellIds(tableId, rowId)` - Returns cell IDs for a specific row
- `useTableCellIds(tableId)` - Returns all cell IDs used across entire table

**Existence Checks:**
- `useHasTables()` - Boolean for any tables existing
- `useHasTable(tableId)` - Boolean for specific table existing
- `useHasRow(tableId, rowId)` - Boolean for specific row existing
- `useHasCell(tableId, rowId, cellId)` - Boolean for specific cell existing

#### Callback Hooks (for mutations triggered by events)

These hooks return callback functions that can be wired to UI events:

- `useSetCellCallback(tableId, rowId, cellId, getCell)` - Returns callback to update a cell based on event parameters
- `useAddRowCallback(tableId, getRow)` - Returns callback to add new row
- `useDelRowCallback(tableId, getRowId)` - Returns callback to delete a row
- `useSetTableCallback(tableId, getTable)` - Returns callback to set entire table
- `useDelTableCallback(tableId)` - Returns callback to delete a table

#### Store Management

- `useCreateStore()` - Memoizes Store creation to prevent recreation across renders
- `useStore()` - Retrieves Store from Provider context
- `useStoreIds()` - Gets IDs of all named Stores in Provider

#### Listener Hooks (for custom side effects)

- `useCellListener(tableId, rowId, cellId, listener)` - Custom listener for cell changes
- `useRowListener(tableId, rowId, listener)` - Custom listener for row changes
- `useTableListener(tableId, listener)` - Custom listener for table changes
- `useValuesListener(listener)` - Custom listener for values changes

#### Best Practices

1. **Automatic Lifecycle Management**: All hooks automatically register listeners on mount and clean them up on unmount. No manual subscription cleanup needed.

2. **Granular Subscriptions**: Use the most specific hook for your needs. For example, prefer `useCell()` over `useRow()` if you only need one cell value - this reduces unnecessary re-renders.

3. **Computed Data**: Use `useMemo()` when transforming TinyBase data (e.g., filtering, mapping) to avoid recomputing on every render. Depend on the specific hook results.

4. **Mutations via Actions**: Direct store mutations should go through action functions (in `src/actions/`), not through callback hooks. Callback hooks are useful when you need event parameters to determine mutation values.

5. **Sorting & Pagination**: `useSortedRowIds()` is ideal for displaying lists sorted by a cell value (like `createdAt` for chat history). It returns just IDs, then use `useRow()` for each item.

6. **Foreign Key Patterns**: When querying related data (e.g., messages for a chat), use `useRowIds()` to get all IDs, then filter/map using the store directly or in `useMemo()`:
   ```typescript
   const messageIds = useRowIds('messages');
   const chatMessages = useMemo(() =>
     messageIds
       .map(id => store.getRow('messages', id))
       .filter(msg => msg?.chatId === currentChatId),
     [messageIds, currentChatId]
   );
   ```

7. **Provider Pattern**: The app uses `<Provider store={store}>` in `_layout.tsx`. All hooks access this store by default. No need to pass store explicitly unless using multiple stores.

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

Tests live in `src/__tests__/`, mirroring the source structure:
- `src/__tests__/actions/` — action function tests
- `src/__tests__/stores/` — store, persister, and encryption tests
- `src/__tests__/stores/migrations/migrations.test.ts` — all migration tests (v2→v3, v3→v4, schema sync, rollback)
- `src/__tests__/stores/migrations/helpers.ts` — shared test helpers (`createTestStore`, `getStoreSnapshot`)
- `src/__tests__/hooks/` — hook tests

Mock conventions:
- Root `__mocks__/` for Expo/node_modules auto-mocks (`expo-crypto`, `expo-secure-store`)
- `src/__mocks__/` for app-level mocks (`main-store-mock.ts`)

```bash
# Run tests
npm test

# Lint
npm run lint
```

When developing features, consider:
- All state changes go through actions that mutate TinyBase store
- UI components read from store via hooks and remain mostly stateless
- Large downloads should use pause/resume pattern with state serialization
- Model operations (load, completion) go through AIChatContext

## Active Technologies
- TypeScript 5.x (React Native / Expo SDK 52) + `expo-crypto` (~15.0.8, already installed), `expo-secure-store` (new), `expo-file-system` (~19.0.17, already installed), `tinybase` (6.6.1, already installed) (001-data-encryption)
- TinyBase store &rarr; custom encrypted persister &rarr; `whisper.json` (AES-256-GCM encrypted bytes); `expo-secure-store` (hardware-backed keychain/keystore) for AES key + credentials (001-data-encryption)
- TypeScript 5.x (React Native / Expo SDK 55) (001-multimodal-input)
- TinyBase store → encrypted `whisper.json` (metadata) + filesystem (media files in sandboxed document directory) (001-multimodal-input)


## Recent Changes
- 001-multimodal-input: Added TypeScript 5.x (React Native / Expo SDK 55)
