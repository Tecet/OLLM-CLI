/**
 * useModalEscapeHandler - Shared ESC key handler for modal components
 * 
 * Provides consistent ESC key handling for modal/dialog components. When ESC is pressed,
 * it calls the onClose callback and closeModal() to properly clean up modal state.
 * 
 * This hook consolidates duplicate ESC handling logic that was previously
 * implemented in every modal component.
 * 
 * @param isOpen - Whether the modal is currently open
 * @param onClose - Callback to close the modal (clean up local state)
 * 
 * @example
 * ```typescript
 * export function MyModal({ onClose }: { onClose: () => void }) {
 *   const focusManager = useFocusManager();
 *   const isOpen = focusManager.isFocused('my-modal');
 *   
 *   // Automatically handles ESC key
 *   useModalEscapeHandler(isOpen, onClose);
 *   
 *   // Handle other input
 *   useInput((input, key) => {
 *     // ... other input handling ...
 *   }, { isActive: isOpen });
 *   
 *   return <Box>...</Box>;
 * }
 * ```
 */

import { useInput } from 'ink';

import { useFocusManager } from '../../features/context/FocusContext.js';

export function useModalEscapeHandler(isOpen: boolean, onClose: () => void): void {
  const { closeModal } = useFocusManager();
  
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      closeModal();
    }
  }, { isActive: isOpen });
}
