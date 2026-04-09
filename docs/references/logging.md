# Logging Reference

Whisper uses a structured logger that replaces direct `console.*` calls. All log entries are severity-tagged, module-scoped, and persisted to a JSON Lines file on disk.

## Import

```typescript
import { createLogger } from "@/src/logger";
```

## Creating a Logger

Call `createLogger` with a module name. The module name appears in every log entry produced by this logger.

```typescript
const logger = createLogger("ModuleName");
```

## Severity Levels

### debug

Verbose detail intended for development only. Debug entries are **not** recorded in production (`__DEV__ === false`); they are silently discarded.

```typescript
logger.debug("Context initialized", { modelPath: uri });
```

### info

Normal operational events. Recorded always (both development and production).

```typescript
logger.info("Model download started", { modelId: "qwen3-0.6b" });
```

### warn

Unexpected but recoverable situations. Recorded always.

```typescript
logger.warn("Retry attempt", { attempt: 3, maxRetries: 5 });
```

### error

Failures that need attention. Recorded always. Error-level entries trigger an **immediate flush** of the in-memory buffer to disk, minimizing data loss if the app crashes shortly after.

```typescript
logger.error("Model load failed", { error: err.message, modelId });
```

## Migrating from console.*

Replace direct console calls with the structured logger.

Before:

```typescript
console.log("Download complete");
console.error("Failed to load model", error);
```

After:

```typescript
import { createLogger } from "@/src/logger";
const logger = createLogger("DownloadManager");

logger.info("Download complete");
logger.error("Failed to load model", { error: error.message });
```

## Privacy Rules

- **Never** log user-generated content (chat messages, conversation names, personal data).
- It is acceptable to log identifiers, counts, and durations (e.g., `chatId`, `messageCount`, `durationMs`).

## Biome Lint Suppression

The logger implementation itself must call `console.*` internally. Suppress the Biome lint rule only in the logger source file:

```typescript
// biome-ignore lint/suspicious/noConsole: Logger implementation must access console
console.log(formatted);
```

Do not use this suppression anywhere else. All other modules should use the structured logger instead.
