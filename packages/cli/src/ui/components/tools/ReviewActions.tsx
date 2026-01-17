import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { useReview, Review } from '../../../features/context/ReviewContext.js';
import { Theme } from '../../../config/types.js';

export interface ReviewActionsProps {
  /** Review ID */
  reviewId: string;
  
  /** Callback when approve is clicked */
  onApprove: (id: string) => Promise<void>;
  
  /** Callback when reject is clicked */
  onReject: (id: string) => Promise<void>;
  
  /** Theme for styling */
  theme: Theme;
  
  /** Whether actions are disabled */
  disabled?: boolean;
}

/**
 * ReviewActions component
 * 
 * Provides approve/reject buttons for a review.
 * Shows loading state during action execution.
 * Displays error messages if actions fail.
 */
export function ReviewActions({
  reviewId,
  onApprove,
  onReject,
  theme,
  disabled = false,
}: ReviewActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await onApprove(reviewId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await onReject(reviewId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box flexDirection="column" gap={1}>
      {/* Action buttons */}
      <Box gap={2}>
        <Box
          borderStyle="single"
          borderColor={disabled || loading ? theme.text.secondary : theme.status.success}
          paddingX={2}
        >
          <Text
            color={disabled || loading ? theme.text.secondary : theme.status.success}
            bold
          >
            {loading ? '⏳ Processing...' : '✓ Approve (y)'}
          </Text>
        </Box>

        <Box
          borderStyle="single"
          borderColor={disabled || loading ? theme.text.secondary : theme.status.error}
          paddingX={2}
        >
          <Text
            color={disabled || loading ? theme.text.secondary : theme.status.error}
            bold
          >
            {loading ? '⏳ Processing...' : '✗ Reject (n)'}
          </Text>
        </Box>
      </Box>

      {/* Error message */}
      {error && (
        <Box>
          <Text color={theme.status.error}>Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}
