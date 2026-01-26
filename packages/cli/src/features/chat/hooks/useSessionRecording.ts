/**
 * Hook for managing chat session recording
 */

import { useCallback, useRef } from 'react';

import type { ServiceContainer } from '@ollm/core';

export interface UseSessionRecordingProps {
  serviceContainer: ServiceContainer | null;
  currentModel: string;
  providerName: string;
}

export interface UseSessionRecordingReturn {
  recordSessionMessage: (role: 'user' | 'assistant', text: string) => Promise<void>;
  sessionId: string | null;
}

/**
 * Manages session recording for chat history persistence
 */
export function useSessionRecording({
  serviceContainer,
  currentModel,
  providerName,
}: UseSessionRecordingProps): UseSessionRecordingReturn {
  const recordingSessionIdRef = useRef<string | null>(null);

  /**
   * Record a message to the current session
   */
  const recordSessionMessage = useCallback(async (role: 'user' | 'assistant', text: string) => {
    if (!serviceContainer) {
      return;
    }
    
    const recordingService = serviceContainer.getChatRecordingService?.();
    if (!recordingService) {
      return;
    }
    
    // Create session if it doesn't exist
    if (!recordingSessionIdRef.current) {
      try {
        recordingSessionIdRef.current = await recordingService.createSession(
          currentModel,
          providerName
        );
      } catch (error) {
        console.error('[ChatRecording] Failed to create session:', error);
        return;
      }
    }
    
    // Record the message
    try {
      await recordingService.recordMessage(recordingSessionIdRef.current, {
        role,
        parts: [{ type: 'text', text }],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[ChatRecording] Failed to record message:', error);
    }
  }, [serviceContainer, currentModel, providerName]);

  return {
    recordSessionMessage,
    sessionId: recordingSessionIdRef.current,
  };
}
