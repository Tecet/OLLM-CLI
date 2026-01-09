# Reusable Code Snippets for OLLM CLI

## Tool Invocation Base (confirmation workflow)
```ts
type ToolCallConfirmationDetails = {
  type: 'info' | 'warning';
  title: string;
  prompt: string;
  onConfirm: (outcome: ToolConfirmationOutcome) => Promise<void>;
};

type ToolConfirmationOutcome =
  | 'Proceed'
  | 'ProceedAlways'
  | 'ProceedAlwaysAndSave'
  | 'Cancel';

interface MessageBus {
  publish(message: unknown): Promise<void>;
}

export interface ToolInvocation<TParams extends object, TResult> {
  params: TParams;
  getDescription(): string;
  toolLocations(): string[];
  shouldConfirmExecute(
    abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false>;
  execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void,
  ): Promise<TResult>;
}

export abstract class BaseToolInvocation<TParams extends object, TResult>
  implements ToolInvocation<TParams, TResult>
{
  constructor(
    readonly params: TParams,
    protected readonly messageBus: MessageBus,
    readonly toolName?: string,
    readonly displayName?: string,
  ) {}

  abstract getDescription(): string;

  toolLocations(): string[] {
    return [];
  }

  async shouldConfirmExecute(
    abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    const decision = await this.getMessageBusDecision(abortSignal);
    if (decision === 'ALLOW') return false;
    if (decision === 'DENY') {
      throw new Error(
        `Tool execution denied: ${this.displayName ?? this.toolName ?? 'tool'}`,
      );
    }
    return this.getConfirmationDetails(abortSignal);
  }

  protected async getConfirmationDetails(
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails> {
    return {
      type: 'info',
      title: `Confirm: ${this.displayName ?? this.toolName ?? 'tool'}`,
      prompt: this.getDescription(),
      onConfirm: async () => {},
    };
  }

  protected async getMessageBusDecision(
    _abortSignal: AbortSignal,
  ): Promise<'ALLOW' | 'DENY' | 'ASK_USER'> {
    return 'ASK_USER';
  }
}
```

## Tool Registry (registration and schema export)
```ts
type ToolSchema = { name: string; description?: string; parameters?: object };

interface AnyDeclarativeTool {
  name: string;
  displayName: string;
  schema: ToolSchema;
}

export class ToolRegistry {
  private allKnownTools = new Map<string, AnyDeclarativeTool>();

  registerTool(tool: AnyDeclarativeTool): void {
    if (this.allKnownTools.has(tool.name)) {
      this.allKnownTools.delete(tool.name);
    }
    this.allKnownTools.set(tool.name, tool);
  }

  unregisterTool(name: string): void {
    this.allKnownTools.delete(name);
  }

  getFunctionDeclarations(): ToolSchema[] {
    return Array.from(this.allKnownTools.values()).map((tool) => tool.schema);
  }

  getAllTools(): AnyDeclarativeTool[] {
    return Array.from(this.allKnownTools.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }
}
```

## Message Bus (request and response over events)
```ts
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

type Message = { type: string; correlationId?: string };

export class MessageBus extends EventEmitter {
  async request<TRequest extends Message, TResponse extends Message>(
    request: Omit<TRequest, 'correlationId'>,
    responseType: TResponse['type'],
    timeoutMs = 60000,
  ): Promise<TResponse> {
    const correlationId = randomUUID();

    return new Promise<TResponse>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off(responseType, responseHandler);
        reject(new Error(`Request timed out waiting for ${responseType}`));
      }, timeoutMs);

      const responseHandler = (response: TResponse) => {
        if (response.correlationId === correlationId) {
          clearTimeout(timeoutId);
          this.off(responseType, responseHandler);
          resolve(response);
        }
      };

      this.on(responseType, responseHandler);
      this.emit(request.type, { ...request, correlationId });
    });
  }
}
```

## Hook Events and Output Helpers
```ts
export enum HookEventName {
  SessionStart = 'SessionStart',
  SessionEnd = 'SessionEnd',
  BeforeAgent = 'BeforeAgent',
  AfterAgent = 'AfterAgent',
  BeforeModel = 'BeforeModel',
  AfterModel = 'AfterModel',
  BeforeToolSelection = 'BeforeToolSelection',
  BeforeTool = 'BeforeTool',
  AfterTool = 'AfterTool',
}

export interface HookInput {
  session_id: string;
  cwd: string;
  hook_event_name: string;
  timestamp: string;
}

export interface HookOutput {
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  decision?: 'ask' | 'block' | 'deny' | 'approve' | 'allow';
  reason?: string;
  hookSpecificOutput?: Record<string, unknown>;
}

export class DefaultHookOutput implements HookOutput {
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  decision?: 'ask' | 'block' | 'deny' | 'approve' | 'allow';
  reason?: string;
  hookSpecificOutput?: Record<string, unknown>;

  constructor(data: Partial<HookOutput> = {}) {
    Object.assign(this, data);
  }

  isBlockingDecision(): boolean {
    return this.decision === 'block' || this.decision === 'deny';
  }

  shouldStopExecution(): boolean {
    return this.continue === false;
  }
}
```

## Shell Execution (PTY with fallback)
```ts
export class ShellExecutionService {
  static async execute(
    commandToExecute: string,
    cwd: string,
    onOutputEvent: (event: ShellOutputEvent) => void,
    abortSignal: AbortSignal,
    shouldUsePty: boolean,
    shellExecutionConfig: ShellExecutionConfig,
  ): Promise<ShellExecutionHandle> {
    if (shouldUsePty) {
      const ptyInfo = await getPty();
      if (ptyInfo) {
        try {
          return this.executeWithPty(
            commandToExecute,
            cwd,
            onOutputEvent,
            abortSignal,
            shellExecutionConfig,
            ptyInfo,
          );
        } catch {
          // Fallback to child process
        }
      }
    }

    return this.childProcessFallback(
      commandToExecute,
      cwd,
      onOutputEvent,
      abortSignal,
      shellExecutionConfig.sanitizationConfig,
    );
  }
}
```

## Environment Sanitization (redaction defaults)
```ts
export type EnvironmentSanitizationConfig = {
  allowedEnvironmentVariables: string[];
  blockedEnvironmentVariables: string[];
  enableEnvironmentVariableRedaction: boolean;
};

const ALWAYS_ALLOWED_ENVIRONMENT_VARIABLES = new Set([
  'PATH',
  'HOME',
  'SHELL',
  'TMP',
  'TMPDIR',
]);

const NEVER_ALLOWED_NAME_PATTERNS = [
  /TOKEN/i,
  /SECRET/i,
  /PASSWORD/i,
  /KEY/i,
] as const;

export function sanitizeEnvironment(
  processEnv: NodeJS.ProcessEnv,
  config: EnvironmentSanitizationConfig,
): NodeJS.ProcessEnv {
  if (!config.enableEnvironmentVariableRedaction) {
    return { ...processEnv };
  }

  const results: NodeJS.ProcessEnv = {};
  const allowedSet = new Set(
    config.allowedEnvironmentVariables.map((k) => k.toUpperCase()),
  );
  const blockedSet = new Set(
    config.blockedEnvironmentVariables.map((k) => k.toUpperCase()),
  );

  for (const key in processEnv) {
    const value = processEnv[key];
    const upperKey = key.toUpperCase();

    if (allowedSet.has(upperKey) || upperKey.startsWith('OLLM_CLI_')) {
      results[key] = value;
      continue;
    }

    if (blockedSet.has(upperKey)) {
      continue;
    }

    if (ALWAYS_ALLOWED_ENVIRONMENT_VARIABLES.has(upperKey)) {
      results[key] = value;
      continue;
    }

    if (NEVER_ALLOWED_NAME_PATTERNS.some((pattern) => pattern.test(upperKey))) {
      continue;
    }

    results[key] = value;
  }

  return results;
}
```
