import React from 'react';
import { useModel } from '../../../features/context/ModelContext.js';
import { ToolsPanel } from '../tools/ToolsPanel.js';

/**
 * ToolsTab component
 * 
 * Displays tools configuration panel with enable/disable toggles.
 * Shows tool support status based on current model capabilities.
 * Organized by categories: File Operations, File Discovery, Shell, Web, Memory, Context.
 * 
 * Requirements: 25.1, 25.2, 25.3, 25.4
 */
export function ToolsTab() {
  const { currentModel, modelSupportsTools } = useModel();
  
  // Check if current model supports tools
  const supportsTools = modelSupportsTools(currentModel);

  return <ToolsPanel modelSupportsTools={supportsTools} />;
}
