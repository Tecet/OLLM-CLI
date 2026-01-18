import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { useReview } from '../../../features/context/ReviewContext.js';
import { DiffViewer } from '../tools/DiffViewer.js';
import { ReviewActions } from '../tools/ReviewActions.js';
import { useContextKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';

/**
 * ToolsTab component
 * 
 * Displays pending reviews with diff viewer and approve/reject actions.
 * Shows tool execution history.
 * Supports batch approve/reject operations.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
export function ToolsTab() {
  const { pendingCount, approve, reject, approveAll, rejectAll, getPendingReviews } = useReview();
  const { state: uiState } = useUI();
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const pendingReviews = getPendingReviews();
  const selectedReview = selectedReviewId
    ? pendingReviews.find((r) => r.id === selectedReviewId)
    : pendingReviews[0];

  // Register review-specific keyboard shortcuts
  useContextKeyboardShortcuts('tools', [
    {
      key: 'y',
      handler: async () => {
        if (selectedReview) {
          await handleApprove(selectedReview.id);
        }
      },
      description: 'Approve current review',
    },
    {
      key: 'n',
      handler: async () => {
        if (selectedReview) {
          await handleReject(selectedReview.id);
        }
      },
      description: 'Reject current review',
    },
    {
      key: 'a',
      handler: async () => {
        if (pendingCount > 1) {
          await handleApproveAll();
        }
      },
      description: 'Approve all reviews',
    },
    {
      key: 'r',
      handler: async () => {
        if (pendingCount > 1) {
          await handleRejectAll();
        }
      },
      description: 'Reject all reviews',
    },
  ]);

  const handleApprove = async (id: string) => {
    await approve(id);
    
    // Select next review if available
    const remaining = getPendingReviews();
    if (remaining.length > 0) {
      setSelectedReviewId(remaining[0].id);
    } else {
      setSelectedReviewId(null);
    }
  };

  const handleReject = async (id: string) => {
    await reject(id);
    
    // Select next review if available
    const remaining = getPendingReviews();
    if (remaining.length > 0) {
      setSelectedReviewId(remaining[0].id);
    } else {
      setSelectedReviewId(null);
    }
  };

  const handleApproveAll = async () => {
    setBatchLoading(true);
    try {
      await approveAll();
      setSelectedReviewId(null);
    } catch (error) {
      console.error('Error approving all:', error);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleRejectAll = async () => {
    setBatchLoading(true);
    try {
      await rejectAll();
      setSelectedReviewId(null);
    } catch (error) {
      console.error('Error rejecting all:', error);
    } finally {
      setBatchLoading(false);
    }
  };

  // No pending reviews
  if (pendingCount === 0) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color={uiState.theme.text.secondary}>
          No pending reviews. All changes have been processed.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header with review count and batch actions */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={uiState.theme.text.accent}
        paddingX={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between">
          <Text bold color={uiState.theme.text.accent}>
            Pending Reviews ({pendingCount})
          </Text>
          
          {pendingCount > 1 && (
            <Box gap={2}>
              <Text
                color={batchLoading ? uiState.theme.text.secondary : uiState.theme.status.success}
              >
                {batchLoading ? '⏳' : '✓'} Approve All
              </Text>
              <Text
                color={batchLoading ? uiState.theme.text.secondary : uiState.theme.status.error}
              >
                {batchLoading ? '⏳' : '✗'} Reject All
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Review list */}
      <Box flexDirection="column" paddingX={1} paddingY={1} flexShrink={0}>
        {pendingReviews.map((review) => {
          const isSelected = selectedReview?.id === review.id;
          
          return (
            <Box
              key={review.id}
              borderStyle={isSelected ? 'double' : 'single'}
              borderColor={isSelected ? uiState.theme.text.accent : uiState.theme.text.secondary}
              paddingX={1}
              marginBottom={1}
            >
              <Text color={isSelected ? uiState.theme.text.accent : uiState.theme.text.primary}>
                {review.file} (+{review.linesAdded} -{review.linesRemoved})
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Selected review details */}
      {selectedReview && (
        <Box flexDirection="column" flexGrow={1} minHeight={0}>
          {/* Diff viewer */}
          <Box flexGrow={1} minHeight={0} paddingX={1}>
            <DiffViewer
              diff={selectedReview.diff}
              fileName={selectedReview.file}
              theme={uiState.theme}
              showLineNumbers={true}
            />
          </Box>

          {/* Review actions */}
          <Box flexShrink={0} paddingX={1} paddingY={1}>
            <ReviewActions
              reviewId={selectedReview.id}
              onApprove={handleApprove}
              onReject={handleReject}
              theme={uiState.theme}
              disabled={batchLoading}
            />
          </Box>
        </Box>
      )}

      {/* Tool execution history section (placeholder) */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={uiState.theme.text.secondary}
        paddingX={1}
        marginTop={1}
        flexShrink={0}
      >
        <Text color={uiState.theme.text.secondary} dimColor>
          Tool Execution History (coming soon)
        </Text>
      </Box>
    </Box>
  );
}
