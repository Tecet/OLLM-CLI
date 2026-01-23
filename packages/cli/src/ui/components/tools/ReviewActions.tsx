import React from 'react';
import { Box, Text } from 'ink';

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
 * Displays keyboard shortcut hints for review actions.
 */
export function ReviewActions({
  reviewId: _reviewId,
  onApprove: _onApprove,
  onReject: _onReject,
  theme,
  disabled = false,
}: ReviewActionsProps) {
  return (
    <Box flexDirection="column" gap={1}>
      {/* Action buttons */}
      <Box gap={2}>
        <Box
          borderStyle="single"
          borderColor={disabled ? theme.text.secondary : theme.status.success}
          paddingX={2}
        >
          <Text
            color={disabled ? theme.text.secondary : theme.status.success}
            bold
          >
            [y] Approve
          </Text>
        </Box>

        <Box
          borderStyle="single"
          borderColor={disabled ? theme.text.secondary : theme.status.error}
          paddingX={2}
        >
          <Text
            color={disabled ? theme.text.secondary : theme.status.error}
            bold
          >
            [n] Reject
          </Text>
        </Box>
      </Box>

    </Box>
  );
}
