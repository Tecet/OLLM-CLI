/**
 * FilesTabWrapper - Wrapper that creates services and providers for FilesTab
 *
 * This component creates the necessary services and wraps FilesTab with FileTreeProvider.
 * Used in App.tsx to avoid prop drilling.
 */

import React, { useMemo } from 'react';

import { FilesTab } from './FilesTab.js';
import {
  FileTreeService,
  FocusSystem,
  EditorIntegration,
  FileOperations,
  FileTreeProvider,
} from '../file-explorer/index.js';

export interface FilesTabWrapperProps {
  width?: number;
  height?: number;
}

export function FilesTabWrapper({ width, height }: FilesTabWrapperProps) {
  // Create services once
  const services = useMemo(() => {
    const fileTreeService = new FileTreeService();
    const focusSystem = new FocusSystem();
    const editorIntegration = new EditorIntegration();
    const fileOperations = new FileOperations(process.cwd());

    return {
      fileTreeService,
      focusSystem,
      editorIntegration,
      fileOperations,
    };
  }, []);

  return (
    <FileTreeProvider>
      <FilesTab
        width={width}
        height={height}
        fileTreeService={services.fileTreeService}
        focusSystem={services.focusSystem}
        editorIntegration={services.editorIntegration}
        fileOperations={services.fileOperations}
      />
    </FileTreeProvider>
  );
}
