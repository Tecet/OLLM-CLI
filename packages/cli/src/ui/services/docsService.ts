import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Documentation entry
 */
export interface DocEntry {
  title: string;
  path: string;
  description?: string;
  children?: DocEntry[];
}

/**
 * DocsService
 *
 * Service for loading and managing documentation files.
 * Provides markdown rendering and navigation support.
 */
export class DocsService {
  private docsRoot: string;
  private cache: Map<string, string> = new Map();

  constructor(docsRoot: string = 'docs') {
    this.docsRoot = docsRoot;
  }

  /**
   * Get the documentation index
   */
  getIndex(): DocEntry[] {
    return [
      { title: 'Getting Started', path: 'docs/README.md', description: 'Introduction to OLLM CLI' },
      {
        title: 'Architecture',
        path: 'docs/architecture.md',
        description: 'System architecture overview',
      },
      { title: 'Commands', path: 'docs/commands.md', description: 'Available CLI commands' },
      {
        title: 'Provider Systems',
        path: 'docs/provider-systems.md',
        description: 'Provider integration guide',
      },
      {
        title: 'Context Management',
        path: 'docs/context-management-plan.md',
        description: 'Context and memory management',
      },
      {
        title: 'UI Design',
        path: 'docs/ui-design-spec.md',
        description: 'UI design specification',
      },
      {
        title: 'Feature Analysis',
        path: 'docs/feature-analysis.md',
        description: 'Feature comparison and analysis',
      },
    ];
  }

  /**
   * Load a documentation file
   */
  async loadDoc(path: string): Promise<string> {
    // Check cache first
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    try {
      const content = await readFile(path, 'utf-8');
      this.cache.set(path, content);
      return content;
    } catch (_error) {
      throw new Error(`Failed to load documentation: ${path}`);
    }
  }

  /**
   * Render markdown to plain text (simplified)
   *
   * In a real implementation, this would use a proper markdown parser.
   * For now, we just strip some basic markdown syntax.
   */
  renderMarkdown(content: string): string {
    // Remove code blocks
    let rendered = content.replace(/```[\s\S]*?```/g, '[code block]');

    // Remove inline code
    rendered = rendered.replace(/`([^`]+)`/g, '$1');

    // Remove bold/italic
    rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '$1');
    rendered = rendered.replace(/\*([^*]+)\*/g, '$1');

    // Remove links but keep text
    rendered = rendered.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    return rendered;
  }

  /**
   * Resolve a link from one document to another
   */
  resolveLink(from: string, to: string): string {
    // If absolute path, return as-is
    if (to.startsWith('/')) {
      return to;
    }

    // If relative path, resolve from current document
    const fromDir = from.substring(0, from.lastIndexOf('/'));
    return join(fromDir, to);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
