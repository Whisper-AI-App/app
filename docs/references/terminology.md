# Domain Terminology

This document defines key terms used throughout the Whisper codebase to ensure consistent understanding across contributors.

| Term | Definition | Notes/Disambiguation |
|------|-----------|----------------------|
| Provider | AI service backend that handles inference requests (e.g., Whisper AI, OpenRouter, OpenAI, HuggingFace, Custom). | Not to be confused with React Context providers. |
| Context | Depends on usage: (1) React Context -- React state container wrapping child components; (2) LlamaContext -- llama.rn instance for on-device inference; (3) Context management in regards to LLMs | Disambiguate by prefix: "React Context" vs "LlamaContext". |
| Store | TinyBase state container holding all app state (chats, messages, settings). | Single store instance, accessed via Provider pattern. |
| Chat | A conversation session containing messages. | Stored in TinyBase `chats` table. |
| Message | A single entry in a chat conversation (user or assistant). | Stored in TinyBase `messages` table, linked to chat via `chatId`. |
| Attachment | A media file (image, audio) linked to a message. | Stored as filesystem files, referenced by message metadata. |
| Folder | An organizational container for grouping chats. | Stored in TinyBase `folders` table. |
| Logger | Structured logging service replacing `console.*`. | Module at `src/logger/`, creates per-module logger instances. |
| DiagnosticsReport | A privacy-safe snapshot of device info and recent operational logs, shareable via native share sheet. | Generated on-demand, never persisted. |
| GGUF | Quantized model file format used by llama.cpp and llama.rn. | Downloaded from HuggingFace, stored in document directory. |
| Persister | TinyBase mechanism for saving/loading store state to/from storage. | Custom encrypted persister at `src/stores/main/encrypted-persister.ts`. |
| Action | A function in `src/actions/` that mutates TinyBase store state. | Business logic layer between UI and store. |
| Values | TinyBase singleton key-value pairs for app-wide settings. | Settings, onboarding status, AI model metadata. |
| Whisper | Depends on usage: (1) "Whisper"/"Whisper AI" Branding for this app; (2) Whisper speech-to-text model we use (https://github.com/openai/whisper)  |  |
