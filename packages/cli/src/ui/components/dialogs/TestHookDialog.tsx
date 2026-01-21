/**
 * TestHookDialog - Dialog for testing hooks
 * 
 * Features:
 * - Simulates hook trigger event
 * - Displays test progress and results
 * - Shows success/failure indicators
 * - Close button
 * 
 * Requirements: 3.8, 3.9
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';

export interface HookTestResult {
  success: boolean;
  message: string;
  details?: string;
}

export interface TestHookDialogProps {
  hook: Hook;
  onClose: () => void;
}

/**
 * Simulate hook test execution
 * This is a placeholder implementation that simulates testing
 */
async function testHook(hook: Hook): Promise<HookTestResult> {
  // Simulate async test execution
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // For now, always return success
  // In a real implementation, this would actually execute the hook in a test environment
  return {
    success: true,
    message: 'Hook test completed successfully',
    details: `Simulated hook execution: ${hook.command} ${hook.args?.join(' ') || ''}`,
  };
}

/**
 * TestHookDialog component
 */
export function TestHookDialog({ hook, onClose: _onClose }: TestHookDialogProps) {
  const { state: uiState } = useUI();
  const [result, setResult] = useState<HookTestResult | null>(null);
  const [testing, setTesting] = useState(true);

  useEffect(() => {
    const runTest = async () => {
      setTesting(true);
      try {
        const testResult = await testHook(hook);
        setResult(testResult);
      } catch (error) {
        setResult({
          success: false,
          message: 'Test failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setTesting(false);
      }
    };

    runTest();
  }, [hook]);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={uiState.theme.border.active}
      padding={1}
      width={60}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Test Hook: {hook.name}
        </Text>
      </Box>

      {/* Test progress or results */}
      {testing ? (
        <Box flexDirection="column" marginBottom={2}>
          <Text color={uiState.theme.text.primary}>Testing hook...</Text>
          <Box marginTop={1}>
            <Text color={uiState.theme.text.secondary} dimColor>
              Command: {hook.command}
            </Text>
          </Box>
          {hook.args && hook.args.length > 0 && (
            <Box marginTop={1}>
              <Text color={uiState.theme.text.secondary} dimColor>
                Arguments: {hook.args.join(' ')}
              </Text>
            </Box>
          )}
        </Box>
      ) : result ? (
        <Box flexDirection="column" marginBottom={2}>
          {/* Result status */}
          <Box marginBottom={1}>
            <Text
              color={
                result.success
                  ? uiState.theme.status.success
                  : uiState.theme.status.error
              }
              bold
            >
              {result.success ? '✓' : '✗'} {result.message}
            </Text>
          </Box>

          {/* Command executed */}
          <Box marginBottom={1}>
            <Text color={uiState.theme.text.secondary}>
              Command: {hook.command}
            </Text>
          </Box>

          {hook.args && hook.args.length > 0 && (
            <Box marginBottom={1}>
              <Text color={uiState.theme.text.secondary}>
                Arguments: {hook.args.join(' ')}
              </Text>
            </Box>
          )}

          {/* Additional details */}
          {result.details && (
            <Box marginTop={1}>
              <Text color={uiState.theme.text.secondary} dimColor>
                {result.details}
              </Text>
            </Box>
          )}
        </Box>
      ) : null}

      {/* Actions */}
      <Box>
        <Text color="yellow">[Esc] Close</Text>
      </Box>

      {/* Note */}
      <Box marginTop={1}>
        <Text color={uiState.theme.text.secondary} dimColor>
          Note: This is a simulated test. Actual hook execution is not performed.
        </Text>
      </Box>
    </Box>
  );
}
