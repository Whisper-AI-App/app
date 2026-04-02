# CLAUDE.md

## Why

Whisper is a 100% private AI chat app built with React Native and Expo. It runs LLMs entirely on-device via llama.rn, ensuring all conversations stay local.

## What

### Tech Stack

- **Framework**: Expo (React Native), Expo Router (file-based routing)
- **State**: TinyBase with typed schemas, persisted to encrypted `whisper.json`
- **AI/ML**: llama.rn for on-device LLM inference
- **UI**: BNA UI components (`components/ui/`)
- **Styling**: React Native StyleSheet with custom theme system
- **Linter**: Biome

### File Structure

- `app/` -- File-based routes (index, dashboard, download, chat)
- `src/actions/` -- State mutation functions
- `src/stores/` -- TinyBase store, persisters, migrations
- `src/logger/` -- Structured logging (replaces `console.*`)
- `src/ai-providers/` -- AI provider implementations
- `src/memory/` -- Device memory management
- `src/stt/` -- Speech-to-text
- `src/utils/` -- Pure utilities
- `contexts/` -- React Context providers
- `components/` -- React components
- `components/ui/` -- Reusable UI primitives
- `components/flows/` -- Multi-step flows (onboarding)
- `hooks/` -- Custom React hooks
- `theme/` -- Theme system (colors, globals, provider)
- `docs/` -- Detailed references and design docs

### Key Patterns

- State changes go through actions (`src/actions/`) that mutate TinyBase store
- Components subscribe via TinyBase hooks (`useValue`, `useRow`, `useSortedRowIds`, etc.)
- Logging uses `createLogger("ModuleName")` from `@/src/logger` -- never use `console.*`
- AI models: download GGUF from HuggingFace -> load via LlamaContext -> stream completions
- Downloads support pause/resume with state serialization
- Single `LlamaContext` instance at a time; release before loading another model

## How

### Commands

```bash
npm install          # Install dependencies
npm run ios          # Run on iOS
npm run android      # Run on Android
npm test             # Run tests
npm run lint         # Lint (Biome)
```

### Testing

- Tests in `src/__tests__/` mirror source structure
- `src/__tests__/actions/` -- action function tests
- `src/__tests__/stores/` -- store, persister, encryption, and migration tests
- `src/__tests__/hooks/` -- hook tests
- Root `__mocks__/` for Expo/node_modules auto-mocks (`expo-crypto`, `expo-secure-store`)
- `src/__mocks__/` for app-level mocks (`main-store-mock.ts`)

### Important Conventions

- Tabs for indentation (Biome enforced)
- Double quotes for strings
- `console.*` is banned -- use `createLogger()` instead (Biome `noConsole` rule)
- Never log user content (messages, names, personal data)
- All state mutations go through action functions, not directly in components
- UI components remain mostly stateless, reading from store via hooks

## Links

- [Architecture](docs/design-docs/architecture.md) -- State management, actions pattern, AI model lifecycle, app flow
- [TinyBase Hooks](docs/references/tinybase-hooks.md) -- Complete hook reference and best practices
- [Logging Guide](docs/references/logging.md) -- Logger usage, severity levels, and migration from console.*
- [Terminology](docs/references/terminology.md) -- Domain-specific terms (Provider, Context, Store, GGUF, etc.)
