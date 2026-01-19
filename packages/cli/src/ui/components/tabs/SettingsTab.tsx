import React from 'react';
import { SettingsPanel } from '../settings/SettingsPanel.js';

/**
 * SettingsTab component
 * 
 * Configuration and settings interface with two-column layout:
 * - Left (30%): Section navigation
 * - Right (70%): Settings editor
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */
export interface SettingsTabProps {
  width?: number;
}

export function SettingsTab({ width }: SettingsTabProps) {
  return <SettingsPanel windowWidth={width} />;
}
