/**
 * UserPromptContext - Manages user prompts for interactive decisions
 *
 * This context provides a Promise-based API for prompting users with questions
 * and collecting their responses. Used for tool support detection, model configuration,
 * and other interactive workflows.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * User prompt data
 */
export interface UserPromptData {
  /** The question/message to display to the user */
  message: string;
  /** Available options for the user to choose from */
  options: string[];
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Default option to use if timeout expires */
  defaultOption?: string;
}

/**
 * User prompt state
 */
export interface UserPromptState {
  /** Currently active prompt */
  activePrompt: UserPromptData | null;
  /** Whether a prompt is visible */
  isVisible: boolean;
  /** Selected option index */
  selectedIndex: number;
  /** Elapsed time in milliseconds (for timeout progress) */
  elapsedTime: number;
}

/**
 * User prompt context value
 */
export interface UserPromptContextValue {
  /** Current prompt state */
  state: UserPromptState;

  /**
   * Prompt the user with a question and options
   * Returns a promise that resolves with the selected option
   */
  promptUser: (
    message: string,
    options: string[],
    timeout?: number,
    defaultOption?: string
  ) => Promise<string>;

  /** Navigate to previous option */
  navigateUp: () => void;

  /** Navigate to next option */
  navigateDown: () => void;

  /** Select current option */
  selectOption: () => void;

  /** Cancel current prompt */
  cancelPrompt: () => void;
}

const UserPromptContext = createContext<UserPromptContextValue | undefined>(undefined);

/**
 * Hook to access user prompt context
 */
export function useUserPrompt(): UserPromptContextValue {
  const context = useContext(UserPromptContext);
  if (!context) {
    throw new Error('useUserPrompt must be used within a UserPromptProvider');
  }
  return context;
}

export interface UserPromptProviderProps {
  children: ReactNode;
}

/**
 * Provider for user prompt management
 */
export function UserPromptProvider({ children }: UserPromptProviderProps) {
  const [state, setState] = useState<UserPromptState>({
    activePrompt: null,
    isVisible: false,
    selectedIndex: 0,
    elapsedTime: 0,
  });

  // Store pending promise resolver
  const [pendingResolve, setPendingResolve] = useState<((value: string) => void) | null>(null);

  // Store timeout handle
  const [timeoutHandle, setTimeoutHandle] = useState<NodeJS.Timeout | null>(null);

  // Store interval handle for elapsed time tracking
  const [intervalHandle, setIntervalHandle] = useState<NodeJS.Timeout | null>(null);

  /**
   * Prompt the user with a question and options
   */
  const promptUser = useCallback(
    (
      message: string,
      options: string[],
      timeout?: number,
      defaultOption?: string
    ): Promise<string> => {
      return new Promise((resolve) => {
        // Clear any existing timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          setTimeoutHandle(null);
        }

        // Clear any existing interval
        if (intervalHandle) {
          clearInterval(intervalHandle);
          setIntervalHandle(null);
        }

        // Set up timeout if specified
        let handle: NodeJS.Timeout | null = null;
        let interval: NodeJS.Timeout | null = null;

        if (timeout && timeout > 0) {
          const startTime = Date.now();

          // Update elapsed time every 100ms
          interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            setState((prev) => ({
              ...prev,
              elapsedTime: elapsed,
            }));
          }, 100);
          setIntervalHandle(interval);

          handle = setTimeout(() => {
            const option = defaultOption || options[0];

            // Clear interval
            if (interval) {
              clearInterval(interval);
              setIntervalHandle(null);
            }

            setState({ activePrompt: null, isVisible: false, selectedIndex: 0, elapsedTime: 0 });
            resolve(option);
            setPendingResolve(null);
            setTimeoutHandle(null);
          }, timeout);
          setTimeoutHandle(handle);
        }

        // Show prompt
        setState({
          activePrompt: {
            message,
            options,
            timeout,
            defaultOption,
          },
          isVisible: true,
          selectedIndex: 0,
          elapsedTime: 0,
        });

        setPendingResolve(() => resolve);
      });
    },
    [timeoutHandle, intervalHandle]
  );

  /**
   * Navigate to previous option
   */
  const navigateUp = useCallback(() => {
    setState((prev) => {
      if (!prev.activePrompt) return prev;
      const optionCount = prev.activePrompt.options.length;
      return {
        ...prev,
        selectedIndex: (prev.selectedIndex - 1 + optionCount) % optionCount,
      };
    });
  }, []);

  /**
   * Navigate to next option
   */
  const navigateDown = useCallback(() => {
    setState((prev) => {
      if (!prev.activePrompt) return prev;
      const optionCount = prev.activePrompt.options.length;
      return {
        ...prev,
        selectedIndex: (prev.selectedIndex + 1) % optionCount,
      };
    });
  }, []);

  /**
   * Select current option
   */
  const selectOption = useCallback(() => {
    if (!state.activePrompt || !pendingResolve) return;

    // Clear timeout if exists
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      setTimeoutHandle(null);
    }

    // Clear interval if exists
    if (intervalHandle) {
      clearInterval(intervalHandle);
      setIntervalHandle(null);
    }

    const selectedOption = state.activePrompt.options[state.selectedIndex];
    setState({ activePrompt: null, isVisible: false, selectedIndex: 0, elapsedTime: 0 });
    pendingResolve(selectedOption);
    setPendingResolve(null);
  }, [state, pendingResolve, timeoutHandle, intervalHandle]);

  /**
   * Cancel current prompt
   */
  const cancelPrompt = useCallback(() => {
    if (!pendingResolve) return;

    // Clear timeout if exists
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      setTimeoutHandle(null);
    }

    // Clear interval if exists
    if (intervalHandle) {
      clearInterval(intervalHandle);
      setIntervalHandle(null);
    }

    // Resolve with first option (safe default)
    const option = state.activePrompt?.options[0] || '';
    setState({ activePrompt: null, isVisible: false, selectedIndex: 0, elapsedTime: 0 });
    pendingResolve(option);
    setPendingResolve(null);
  }, [pendingResolve, timeoutHandle, intervalHandle, state.activePrompt]);

  const value: UserPromptContextValue = {
    state,
    promptUser,
    navigateUp,
    navigateDown,
    selectOption,
    cancelPrompt,
  };

  return <UserPromptContext.Provider value={value}>{children}</UserPromptContext.Provider>;
}
