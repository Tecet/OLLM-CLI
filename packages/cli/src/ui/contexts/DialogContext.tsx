/**
 * DialogContext - Manages dialog state and interactions
 * 
 * Provides a centralized way to show/hide dialogs and handle user responses.
 * Supports hook approval, confirmations, and other modal interactions.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';

/**
 * Types of dialogs that can be shown
 */
export type DialogType = 'hookApproval' | 'confirmation' | 'error' | 'info';

/**
 * Hook approval dialog data
 */
export interface HookApprovalDialogData {
  type: 'hookApproval';
  hook: Hook;
  hash: string;
  onApprove: () => void;
  onDeny: () => void;
}

/**
 * Confirmation dialog data
 */
export interface ConfirmationDialogData {
  type: 'confirmation';
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Error dialog data
 */
export interface ErrorDialogData {
  type: 'error';
  title: string;
  message: string;
  onClose: () => void;
}

/**
 * Info dialog data
 */
export interface InfoDialogData {
  type: 'info';
  title: string;
  message: string;
  onClose: () => void;
}

/**
 * Union type for all dialog data
 */
export type DialogData =
  | HookApprovalDialogData
  | ConfirmationDialogData
  | ErrorDialogData
  | InfoDialogData;

/**
 * Dialog state
 */
export interface DialogState {
  /** Currently active dialog */
  activeDialog: DialogData | null;
  /** Whether a dialog is visible */
  isVisible: boolean;
}

/**
 * Dialog context value
 */
export interface DialogContextValue {
  /** Current dialog state */
  state: DialogState;
  /** Show hook approval dialog */
  showHookApproval: (hook: Hook, hash: string) => Promise<boolean>;
  /** Show confirmation dialog */
  showConfirmation: (title: string, message: string) => Promise<boolean>;
  /** Show error dialog */
  showError: (title: string, message: string) => Promise<void>;
  /** Show info dialog */
  showInfo: (title: string, message: string) => Promise<void>;
  /** Close current dialog */
  closeDialog: () => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

/**
 * Hook to access dialog context
 */
export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

export interface DialogProviderProps {
  children: ReactNode;
}

/**
 * Provider for dialog management
 */
export function DialogProvider({ children }: DialogProviderProps) {
  const [state, setState] = useState<DialogState>({
    activeDialog: null,
    isVisible: false,
  });

  // Store pending promises for async dialog operations
  const [pendingResolve, setPendingResolve] = useState<((value: boolean) => void) | null>(
    null
  );

  /**
   * Show hook approval dialog
   */
  const showHookApproval = useCallback(
    (hook: Hook, hash: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const onApprove = () => {
          setState({ activeDialog: null, isVisible: false });
          resolve(true);
          setPendingResolve(null);
        };

        const onDeny = () => {
          setState({ activeDialog: null, isVisible: false });
          resolve(false);
          setPendingResolve(null);
        };

        setState({
          activeDialog: {
            type: 'hookApproval',
            hook,
            hash,
            onApprove,
            onDeny,
          },
          isVisible: true,
        });

        setPendingResolve(() => resolve);
      });
    },
    []
  );

  /**
   * Show confirmation dialog
   */
  const showConfirmation = useCallback(
    (title: string, message: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const onConfirm = () => {
          setState({ activeDialog: null, isVisible: false });
          resolve(true);
          setPendingResolve(null);
        };

        const onCancel = () => {
          setState({ activeDialog: null, isVisible: false });
          resolve(false);
          setPendingResolve(null);
        };

        setState({
          activeDialog: {
            type: 'confirmation',
            title,
            message,
            onConfirm,
            onCancel,
          },
          isVisible: true,
        });

        setPendingResolve(() => resolve);
      });
    },
    []
  );

  /**
   * Show error dialog
   */
  const showError = useCallback(
    (title: string, message: string): Promise<void> => {
      return new Promise((resolve) => {
        const onClose = () => {
          setState({ activeDialog: null, isVisible: false });
          resolve();
          setPendingResolve(null);
        };

        setState({
          activeDialog: {
            type: 'error',
            title,
            message,
            onClose,
          },
          isVisible: true,
        });

        setPendingResolve(() => resolve);
      });
    },
    []
  );

  /**
   * Show info dialog
   */
  const showInfo = useCallback(
    (title: string, message: string): Promise<void> => {
      return new Promise((resolve) => {
        const onClose = () => {
          setState({ activeDialog: null, isVisible: false });
          resolve();
          setPendingResolve(null);
        };

        setState({
          activeDialog: {
            type: 'info',
            title,
            message,
            onClose,
          },
          isVisible: true,
        });

        setPendingResolve(() => resolve);
      });
    },
    []
  );

  /**
   * Close current dialog
   */
  const closeDialog = useCallback(() => {
    // If there's a pending promise, resolve it with false/void
    if (pendingResolve) {
      pendingResolve(false);
      setPendingResolve(null);
    }

    setState({ activeDialog: null, isVisible: false });
  }, [pendingResolve]);

  const value: DialogContextValue = {
    state,
    showHookApproval,
    showConfirmation,
    showError,
    showInfo,
    closeDialog,
  };

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}
