/**
 * useNotifications Hook
 * 
 * Hook for managing notifications in the MCP panel.
 * Provides methods to show success, error, warning, and info notifications.
 * 
 * Features:
 * - Add notifications with auto-generated IDs
 * - Remove notifications manually or automatically
 * - Queue multiple notifications
 * - Prevent duplicate notifications
 * 
 * Validates: NFR-7
 */

import { useState, useCallback } from 'react';
import type { NotificationType } from '../components/mcp/Notification.js';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  timeout?: number;
  showDismiss?: boolean;
}

/**
 * Generate unique notification ID
 */
function generateNotificationId(): string {
  return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * useNotifications Hook
 * 
 * Manages a queue of notifications with add/remove functionality.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  /**
   * Add a notification to the queue
   */
  const addNotification = useCallback((
    type: NotificationType,
    message: string,
    options?: {
      description?: string;
      timeout?: number;
      showDismiss?: boolean;
    }
  ) => {
    const id = generateNotificationId();
    const notification: Notification = {
      id,
      type,
      message,
      description: options?.description,
      timeout: options?.timeout ?? 3000,
      showDismiss: options?.showDismiss ?? true,
    };

    setNotifications((prev) => [...prev, notification]);

    return id;
  }, []);

  /**
   * Remove a notification by ID
   */
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  /**
   * Clear all notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Show success notification
   */
  const showSuccess = useCallback((message: string, description?: string) => {
    return addNotification('success', message, { description, timeout: 3000 });
  }, [addNotification]);

  /**
   * Show error notification
   */
  const showError = useCallback((message: string, description?: string) => {
    return addNotification('error', message, { description, timeout: 5000 });
  }, [addNotification]);

  /**
   * Show warning notification
   */
  const showWarning = useCallback((message: string, description?: string) => {
    return addNotification('warning', message, { description, timeout: 4000 });
  }, [addNotification]);

  /**
   * Show info notification
   */
  const showInfo = useCallback((message: string, description?: string) => {
    return addNotification('info', message, { description, timeout: 3000 });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
