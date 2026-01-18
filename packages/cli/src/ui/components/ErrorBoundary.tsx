/**
 * Error Boundary Component
 * Catches errors in React components and displays user-friendly error messages.
 */

import React, { Component, ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../features/context/UIContext.js';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error boundary component for catching and handling React errors
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to debug output
    if (process.env.OLLM_LOG_LEVEL === 'debug') {
      console.error('[Error Boundary] Component error:', error);
      console.error('[Error Boundary] Error info:', errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!);
      }

      // Default error display
      // Use theme from UI context when available
      const borderColor = 'red';
      const textColor = 'red';

      return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor={borderColor}>
          <Text color={textColor} bold>
            ❌ An error occurred
          </Text>
          <Text color={textColor}>{this.state.error.message}</Text>
          
          {process.env.OLLM_LOG_LEVEL === 'debug' && this.state.errorInfo && (
            <Box flexDirection="column" marginTop={1}>
              <Text dimColor>Stack trace:</Text>
              <Text dimColor>{this.state.errorInfo.componentStack}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text dimColor>Press Ctrl+C to exit or continue using the application</Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
export const DefaultErrorFallback: React.FC<{ error: Error; errorInfo: React.ErrorInfo }> = ({
  error,
  errorInfo,
}) => {
      const theme = useUI().state.theme;
      const borderColor = theme.border.primary;
      const textColor = theme.status.error;

      return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor={borderColor}>
          <Text color={textColor} bold>
            ❌ Component Error
          </Text>
          <Text color={textColor}>{error.message}</Text>
      
      <Box marginTop={1}>
        <Text dimColor>The application encountered an error but will continue running.</Text>
      </Box>
      
      {process.env.OLLM_LOG_LEVEL === 'debug' && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Component stack:</Text>
          <Text dimColor>{errorInfo.componentStack}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Minimal error fallback for critical errors
 */
export const MinimalErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  const theme = useUI().state.theme;
  const textColor = theme.status.error;

  return (
    <Box padding={1}>
      <Text color={textColor}>❌ Error: {error.message}</Text>
    </Box>
  );
};
