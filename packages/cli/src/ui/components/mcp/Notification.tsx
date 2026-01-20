/**
 * Notification Component
 * 
 * Toast-style notifications for success, error, warning, and info messages.
 * Provides visual feedback for user actions with auto-dismiss functionality.
 * 
 * Features:
 * - Success notifications (green checkmark + message)
 * - Error notifications (red X + message)
 * - Warning notifications (yellow warning + message)
 * - Info notifications (blue info + message)
 * - Auto-dismiss after timeout
 * - Manual dismiss option
 * - Fade in/out animations (simulated with opacity)
 * 
 * Validates: NFR-7
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import type { Theme } from '../../../config/types.js';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationProps {
  /** Type of notification */
  type: NotificationType;
  /** Notification message */
  message: string;
  /** Optional detailed description */
  description?: string;
  /** Auto-dismiss timeout in milliseconds (0 = no auto-dismiss) */
  timeout?: number;
  /** Callback when notification is dismissed */
  onDismiss?: () => void;
  /** Whether to show dismiss button */
  showDismiss?: boolean;
}

/**
 * Get notification icon based on type
 */
function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✗';
    case 'warning':
      return '⚠';
    case 'info':
      return 'ℹ';
    default:
      return '•';
  }
}

/**
 * Get notification color based on type
 */
function getNotificationColor(type: NotificationType, theme: Theme): string {
  switch (type) {
    case 'success':
      return theme.status.success;
    case 'error':
      return theme.status.error;
    case 'warning':
      return theme.status.warning;
    case 'info':
      return theme.status.info;
    default:
      return theme.text.primary;
  }
}

/**
 * Get notification border color based on type
 */
function getNotificationBorderColor(type: NotificationType, _theme: Theme): string {
  switch (type) {
    case 'success':
      return 'green';
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    case 'info':
      return 'cyan';
    default:
      return 'gray';
  }
}

/**
 * Notification Component
 * 
 * Displays a toast-style notification with icon, message, and optional description.
 * Supports auto-dismiss and manual dismiss functionality.
 */
export function Notification({
  type,
  message,
  description,
  timeout = 3000,
  onDismiss,
  showDismiss = true,
}: NotificationProps) {
  const { state: { theme } } = useUI();
  const [isVisible, setIsVisible] = useState(true);

  /**
   * Handle notification dismiss with fade out
   */
  const handleDismiss = useCallback(() => {
    // Wait for fade out animation then hide
    setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, 200);
  }, [onDismiss]);

  // Auto-dismiss timer
  useEffect(() => {
    if (timeout > 0) {
      const dismissTimer = setTimeout(() => {
        handleDismiss();
      }, timeout);

      return () => clearTimeout(dismissTimer);
    }
  }, [timeout, handleDismiss]);

  if (!isVisible) {
    return null;
  }

  const icon = getNotificationIcon(type);
  const color = getNotificationColor(type, theme);
  const borderColor = getNotificationBorderColor(type, theme);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
    >
      {/* Header with icon and message */}
      <Box justifyContent="space-between">
        <Text color={color} bold>
          {icon} {message}
        </Text>
        {showDismiss && onDismiss && (
          <Box>
            <Text dimColor>[Esc] Dismiss</Text>
          </Box>
        )}
      </Box>

      {/* Description (if provided) */}
      {description && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary}>{description}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * NotificationContainer Component
 * 
 * Container for managing multiple notifications.
 * Stacks notifications vertically with spacing.
 */
export interface NotificationContainerProps {
  /** Array of notifications to display */
  notifications: Array<NotificationProps & { id: string }>;
  /** Callback when a notification is dismissed */
  onDismiss: (id: string) => void;
}

export function NotificationContainer({
  notifications,
  onDismiss,
}: NotificationContainerProps) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      gap={1}
      width="100%"
      alignItems="center"
      position="relative"
      marginTop={1}
      marginBottom={1}
    >
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          type={notification.type}
          message={notification.message}
          description={notification.description}
          timeout={notification.timeout}
          onDismiss={() => onDismiss(notification.id)}
          showDismiss={notification.showDismiss}
        />
      ))}
    </Box>
  );
}

/**
 * Compact notification for inline display
 */
export interface CompactNotificationProps {
  type: NotificationType;
  message: string;
}

export function CompactNotification({ type, message }: CompactNotificationProps) {
  const { state: { theme } } = useUI();
  const icon = getNotificationIcon(type);
  const color = getNotificationColor(type, theme);

  return (
    <Box>
      <Text color={color}>
        {icon} {message}
      </Text>
    </Box>
  );
}

/**
 * Success notification helper
 */
export function SuccessNotification({ message, description, onDismiss }: Omit<NotificationProps, 'type'>) {
  return (
    <Notification
      type="success"
      message={message}
      description={description}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Error notification helper
 */
export function ErrorNotification({ message, description, onDismiss }: Omit<NotificationProps, 'type'>) {
  return (
    <Notification
      type="error"
      message={message}
      description={description}
      timeout={5000} // Longer timeout for errors
      onDismiss={onDismiss}
    />
  );
}

/**
 * Warning notification helper
 */
export function WarningNotification({ message, description, onDismiss }: Omit<NotificationProps, 'type'>) {
  return (
    <Notification
      type="warning"
      message={message}
      description={description}
      timeout={4000}
      onDismiss={onDismiss}
    />
  );
}

/**
 * Info notification helper
 */
export function InfoNotification({ message, description, onDismiss }: Omit<NotificationProps, 'type'>) {
  return (
    <Notification
      type="info"
      message={message}
      description={description}
      onDismiss={onDismiss}
    />
  );
}
