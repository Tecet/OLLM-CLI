/**
 * Hook for managing confirmation dialog state
 * 
 * Provides a standardized way to manage confirmation dialogs with
 * loading, success, and error states. Reduces code duplication across
 * components that need confirmation flows.
 * 
 * @example
 * ```typescript
 * const confirmation = useConfirmation({
 *   onConfirm: async () => {
 *     await deleteItem(itemId);
 *   },
 *   onSuccess: () => {
 *     showNotification('Item deleted');
 *   }
 * });
 * 
 * return (
 *   <ConfirmationDialog
 *     isOpen={confirmation.isOpen}
 *     status={confirmation.status}
 *     selection={confirmation.selection}
 *     onSelectionChange={confirmation.setSelection}
 *     onConfirm={confirmation.confirm}
 *     onCancel={confirmation.cancel}
 *   />
 * );
 * ```
 */

import { useState, useCallback } from 'react';

export type ConfirmationStatus =
  | 'idle'
  | 'confirm'
  | 'processing'
  | 'success'
  | 'error';

export type ConfirmationSelection = 'yes' | 'no';

export interface ConfirmationOptions {
  /** Callback to execute when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Callback to execute on success */
  onSuccess?: () => void;
  /** Callback to execute on error */
  onError?: (error: Error) => void;
  /** Callback to execute on cancel */
  onCancel?: () => void;
  /** Auto-close delay in ms after success (default: 1000) */
  autoCloseDelay?: number;
}

export interface ConfirmationState {
  /** Whether the confirmation dialog is open */
  isOpen: boolean;
  /** Current status of the confirmation flow */
  status: ConfirmationStatus;
  /** Current selection (yes/no) */
  selection: ConfirmationSelection;
  /** Error message if status is 'error' */
  error?: string;
  /** Open the confirmation dialog */
  open: () => void;
  /** Close the confirmation dialog */
  close: () => void;
  /** Set the selection */
  setSelection: (selection: ConfirmationSelection) => void;
  /** Confirm and execute the action */
  confirm: () => Promise<void>;
  /** Cancel the confirmation */
  cancel: () => void;
  /** Reset to initial state */
  reset: () => void;
}

/**
 * Hook for managing confirmation dialog state
 * 
 * Handles the complete confirmation flow:
 * 1. Open dialog (status: 'confirm')
 * 2. User selects yes/no
 * 3. On confirm, execute action (status: 'processing')
 * 4. On success (status: 'success'), auto-close after delay
 * 5. On error (status: 'error'), show error message
 * 6. On cancel, close dialog
 */
export function useConfirmation(options: ConfirmationOptions): ConfirmationState {
  const {
    onConfirm,
    onSuccess,
    onError,
    onCancel,
    autoCloseDelay = 1000,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ConfirmationStatus>('idle');
  const [selection, setSelection] = useState<ConfirmationSelection>('no');
  const [error, setError] = useState<string | undefined>();

  const open = useCallback(() => {
    setIsOpen(true);
    setStatus('confirm');
    setSelection('no');
    setError(undefined);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setStatus('idle');
    setSelection('no');
    setError(undefined);
  }, []);

  const cancel = useCallback(() => {
    close();
    onCancel?.();
  }, [close, onCancel]);

  const confirm = useCallback(async () => {
    if (selection !== 'yes') {
      cancel();
      return;
    }

    setStatus('processing');
    setError(undefined);

    try {
      await onConfirm();
      setStatus('success');
      onSuccess?.();

      // Auto-close after delay
      setTimeout(() => {
        close();
      }, autoCloseDelay);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('error');
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [selection, onConfirm, onSuccess, onError, cancel, close, autoCloseDelay]);

  const reset = useCallback(() => {
    setIsOpen(false);
    setStatus('idle');
    setSelection('no');
    setError(undefined);
  }, []);

  return {
    isOpen,
    status,
    selection,
    error,
    open,
    close,
    setSelection,
    confirm,
    cancel,
    reset,
  };
}
