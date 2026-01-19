/**
 * MCP Panel UI Components
 * 
 * This module exports all MCP-related UI components for managing
 * MCP servers, marketplace, and configuration.
 */

// Core components
export { HealthIndicator, formatUptime } from './HealthIndicator';
export type { HealthStatus } from './HealthIndicator';

export { ServerItem } from './ServerItem';
export type { ServerItemProps } from './ServerItem';

export { ServerListItem } from './ServerListItem';
export type { ServerListItemProps } from './ServerListItem';

export { MarketplacePreview } from './MarketplacePreview';
export type { MarketplacePreviewProps } from './MarketplacePreview';

export { InstalledServersSection } from './InstalledServersSection';
export type { InstalledServersSectionProps } from './InstalledServersSection';

export { MCPActions } from './MCPActions';
export type { MCPActionsProps } from './MCPActions';

export { ServerDetails } from './ServerDetails';
export type { ServerDetailsProps } from './ServerDetails';

// Loading and progress components
export { LoadingSpinner } from './LoadingSpinner';
export type { LoadingSpinnerProps } from './LoadingSpinner';

export { ServerSkeleton } from './ServerSkeleton';
export type { ServerSkeletonProps } from './ServerSkeleton';

export { ProgressIndicator } from './ProgressIndicator';
export type { ProgressIndicatorProps } from './ProgressIndicator';

export { OperationProgress } from './OperationProgress';
export type { OperationProgressProps } from './OperationProgress';

// Notification and feedback components
export { 
  Notification, 
  NotificationContainer,
  CompactNotification,
  SuccessNotification,
  ErrorNotification,
  WarningNotification,
  InfoNotification,
} from './Notification';
export type { 
  NotificationProps, 
  NotificationContainerProps,
  CompactNotificationProps,
  NotificationType,
} from './Notification';

// Animation components
export {
  FadeTransition,
  SlideIn,
  Pulse,
  Blink,
} from './FadeTransition';
export type {
  FadeTransitionProps,
  SlideInProps,
  PulseProps,
  BlinkProps,
} from './FadeTransition';

// Re-export types from MCPContext for convenience
export type { ExtendedMCPServerStatus, ExtendedMCPServerConfig } from '../../contexts/MCPContext';
