/**
 * useFocusedFilesInjection - Hook for injecting focused files into system prompts
 *
 * This hook safely accesses the FileFocusContext and provides a function
 * to inject focused files into system prompts.
 */

import { useContext } from 'react';

import { FileFocusContext } from '../../ui/components/file-explorer/FileFocusContext.js';
import { injectFocusedFiles } from '../../ui/components/file-explorer/FocusedFilesInjector.js';

/**
 * Hook to inject focused files into system prompts
 *
 * Returns a function that takes a system prompt and returns it with
 * focused files injected. If FileFocusContext is not available (e.g.,
 * File Explorer not mounted), returns the prompt unchanged.
 *
 * @returns Function to inject focused files into a prompt
 */
export function useFocusedFilesInjection(): (prompt: string) => string {
  // Access FileFocusContext (call hooks unconditionally)
  const fileFocusContext = useContext(FileFocusContext);

  return (prompt: string): string => {
    // If FileFocusContext is not available, return prompt unchanged
    if (!fileFocusContext) {
      return prompt;
    }

    // Get all focused files
    const focusedFiles = fileFocusContext.getAllFocusedFiles();

    // If no focused files, return prompt unchanged
    if (focusedFiles.length === 0) {
      return prompt;
    }

    // Inject focused files into the prompt
    return injectFocusedFiles(focusedFiles, prompt);
  };
}
