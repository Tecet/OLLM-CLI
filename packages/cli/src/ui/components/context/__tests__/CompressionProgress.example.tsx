/**
 * CompressionProgress Component Example
 *
 * This file demonstrates how to use the CompressionProgress component
 * in different states. This is for documentation purposes only.
 */

import React from 'react';
import { CompressionProgress } from '../CompressionProgress.js';

// Example 1: Active compression with stage
export function Example1_ActiveCompression() {
  return (
    <CompressionProgress
      active={true}
      stage="summarizing"
      messageCount={15}
    />
  );
}

// Example 2: Active compression with progress bar
export function Example2_WithProgress() {
  return (
    <CompressionProgress
      active={true}
      stage="creating-checkpoint"
      progress={65}
      messageCount={20}
    />
  );
}

// Example 3: Compression complete
export function Example3_Complete() {
  return (
    <CompressionProgress
      active={false}
      complete={true}
      messageCount={18}
      tokensFreed={2500}
    />
  );
}

// Example 4: Compression error
export function Example4_Error() {
  return (
    <CompressionProgress
      active={false}
      error="LLM summarization timed out after 30 seconds"
    />
  );
}

// Example 5: Integration with ContextManager
export function Example5_Integration() {
  // In real usage, you would get this from useContextManager()
  const contextState = {
    compressing: true,
    // ... other state
  };

  return (
    <>
      {contextState.compressing && (
        <CompressionProgress
          active={contextState.compressing}
          stage="summarizing"
        />
      )}
    </>
  );
}

/**
 * Usage in App.tsx:
 *
 * ```tsx
 * import { CompressionProgress } from './components/context/CompressionProgress.js';
 * import { useContextManager } from '../features/context/ContextManagerContext.js';
 *
 * function App() {
 *   const { state: contextState } = useContextManager();
 *
 *   return (
 *     <Box>
 *       {/* Your main UI *\/}
 *
 *       {/* Compression Progress Overlay *\/}
 *       {contextState.compressing && (
 *         <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">
 *           <CompressionProgress active={contextState.compressing} />
 *         </Box>
 *       )}
 *     </Box>
 *   );
 * }
 * ```
 *
 * Input Blocking in ChatInputArea:
 *
 * ```tsx
 * import { useContextManager } from '../../../features/context/ContextManagerContext.js';
 *
 * function ChatInputArea() {
 *   const { state: contextState } = useContextManager();
 *
 *   return (
 *     <InputBox
 *       disabled={contextState.compressing}
 *       placeholder={contextState.compressing ? 'Compressing context... Please wait.' : 'Type a message...'}
 *     />
 *   );
 * }
 * ```
 */
