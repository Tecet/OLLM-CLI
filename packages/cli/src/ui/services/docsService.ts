import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import os from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface DocEntry {
  title: string;
  path: string;
  description?: string;
  children?: DocEntry[];
}

/**
 * Resolve the nearest packaged `docs` folder by walking up from the
 * module's directory. This works both in development (src) and after
 * packaging (dist) where `__dirname` is inside the package tree.
 */
/**
 * DocsService - simplified behavior
 * Always load docs from the package's installed `docs` folder located
 * relative to this module (three levels up from `dist/ui/services`).
 * No searching or fallback logic — single source of truth.
 */
export class DocsService {
  private docsRoot: string;
  private cache: Map<string, string> = new Map();

  constructor() {
    // Resolve module directory in both CommonJS and ESM runtimes
    const moduleDir = typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
    // Up three levels reaches the package root; docs live under <pkgRoot>/docs
    const packaged = join(moduleDir, '..', '..', '..', 'docs');
    // Prefer user-installed docs at %USERPROFILE%/.ollm/docs if present
    const userDocs = join(os.homedir(), '.ollm', 'docs');
    this.docsRoot = existsSync(userDocs) ? userDocs : packaged;
  }

  getIndex(): DocEntry[] {
    return [
      { title: 'Getting Started', path: 'docs/README.md', description: 'Introduction to OLLM CLI' },
      { title: 'Architecture', path: 'docs/architecture.md', description: 'System architecture overview' },
      { title: 'Commands', path: 'docs/commands.md', description: 'Available CLI commands' },
      { title: 'Provider Systems', path: 'docs/provider-systems.md', description: 'Provider integration guide' },
      { title: 'Context Management', path: 'docs/context-management-plan.md', description: 'Context and memory management' },
      { title: 'UI Design', path: 'docs/ui-design-spec.md', description: 'UI design specification' },
      { title: 'Feature Analysis', path: 'docs/feature-analysis.md', description: 'Feature comparison and analysis' },
    ];
  }

  async loadDoc(docPath: string): Promise<string> {
    if (this.cache.has(docPath)) return this.cache.get(docPath)!;

    const rel = docPath.startsWith('docs/') ? docPath.substring('docs/'.length) : docPath;
    const target = join(this.docsRoot, rel);
    try {
      const content = await readFile(target, 'utf-8');
      this.cache.set(docPath, content);
      return content;
    } catch (e) {
      throw new Error(`Failed to load documentation from ${target}: ${String(e)}`);
    }
  }

  renderMarkdown(content: string): string {
    let rendered = content.replace(/```[\s\S]*?```/g, '[code block]');
    rendered = rendered.replace(/`([^`]+)`/g, '$1');
    rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '$1');
    rendered = rendered.replace(/\*([^*]+)\*/g, '$1');
    rendered = rendered.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    return rendered;
  }

  resolveLink(from: string, to: string): string {
    if (to.startsWith('/')) return to;
    const fromDir = from.substring(0, from.lastIndexOf('/'));
    return join(fromDir, to);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// singleton
export const docsService = new DocsService();
