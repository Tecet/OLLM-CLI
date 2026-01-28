/**
 * Type definitions for chat functionality
 */

/**
 * Tool call information for UI
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  duration?: number;
  status: 'pending' | 'success' | 'error';
}

/**
 * Reasoning block from model thinking process
 */
export interface ReasoningBlock {
  content: string;
  tokenCount: number;
  duration: number;
  complete: boolean;
}

/**
 * Inference metrics for performance tracking
 */
export interface InferenceMetrics {
  // Raw values from provider
  promptTokens: number;
  completionTokens: number;
  totalDuration: number; // Nanoseconds
  promptDuration: number; // Nanoseconds
  evalDuration: number; // Nanoseconds

  // Calculated values
  tokensPerSecond: number;
  timeToFirstToken: number; // Seconds
  totalSeconds: number;

  // Optional
  loadDuration?: number;
}

/**
 * Chat message
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;

  // Optional fields
  toolCalls?: ToolCall[];
  reasoning?: ReasoningBlock;
  metrics?: InferenceMetrics;

  // UI state
  expanded?: boolean;
  editing?: boolean;

  // Context management
  excludeFromContext?: boolean;
  toolCallId?: string; // For tool role
}

/**
 * Menu option for interactive selection
 */
export interface MenuOption {
  id: string;
  label: string;
  action: () => void | Promise<void>;
  value?: unknown;
  disabled?: boolean;
}

/**
 * Menu state for interactive prompts
 */
export interface MenuState {
  active: boolean;
  options: MenuOption[];
  selectedIndex: number;
  messageId?: string; // ID of the message this menu is attached to
}

/**
 * Chat state
 */
export interface ChatState {
  messages: Message[];
  streaming: boolean;
  waitingForResponse: boolean;
  currentInput: string;
  inputMode: 'text' | 'menu';
  menuState: MenuState;
  statusMessage?: string;
}

/**
 * Context usage statistics
 */
export interface ContextUsage {
  currentTokens: number;
  maxTokens: number;
}

/**
 * Chat context value exposed to consumers
 */
export interface ChatContextValue {
  state: ChatState;

  /** Send a message to the assistant */
  sendMessage: (content: string) => Promise<void>;

  /** Cancel the current generation */
  cancelGeneration: () => void;

  /** Clear all messages */
  clearChat: () => void;

  /** Edit a message */
  editMessage: (id: string, content: string) => void;

  /** Set the current input value */
  setCurrentInput: (input: string) => void;

  /** Add a message to the chat */
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;

  /** Update a message */
  updateMessage: (id: string, updates: Partial<Message>) => void;

  /** Set streaming state */
  setStreaming: (streaming: boolean) => void;

  /** Set waiting for response state */
  setWaitingForResponse: (waiting: boolean) => void;

  /** Set a sticky status message */
  setStatusMessage: (message: string | undefined) => void;

  /** Current context usage stats */
  contextUsage: ContextUsage;

  /** Set input mode */
  setInputMode: (mode: 'text' | 'menu') => void;

  /** Update menu state */
  setMenuState: (state: Partial<MenuState>) => void;

  /** Execute selected menu option */
  executeMenuOption: () => Promise<void>;

  /** Navigate menu */
  navigateMenu: (direction: 'up' | 'down') => void;

  /** Activate menu for a message */
  activateMenu: (options: MenuOption[], messageId?: string) => void;

  /** Request manual context input */
  requestManualContextInput: (
    modelId: string,
    onComplete: (value: number) => void | Promise<void>
  ) => void;

  /** Scroll State */
  selectedLineIndex: number;
  setSelectedLineIndex: (index: number | ((prev: number) => number)) => void;
  scrollOffset: number;
  scrollUp: () => void;
  scrollDown: () => void;
}
