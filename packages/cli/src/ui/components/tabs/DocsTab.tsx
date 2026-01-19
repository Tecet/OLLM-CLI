import React from 'react';
import { DocsPanel } from '../docs/DocsPanel.js';

/**
 * DocsTab component
 * 
 * Documentation browser with two-column layout:
 * - Left (30%): Document navigation tree
 * - Right (70%): Document content viewer
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
interface DocsTabProps {
  height: number;
  width?: number;
}

export function DocsTab({ height, width }: DocsTabProps) {
  return <DocsPanel height={height} windowWidth={width} />;
}
