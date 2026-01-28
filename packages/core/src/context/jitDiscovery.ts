import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Result of a context discovery operation
 */
export interface DiscoveryResult {
  /** Files discovered and loaded */
  files: Array<{
    path: string;
    content: string;
  }>;
  /** Concatenated instructions for the LLM */
  instructions: string;
}

/**
 * Discovers and loads context from markdown files by traversing upwards
 * from the target path to the nearest trusted root.
 *
 * @param targetPath - The path being accessed
 * @param trustedRoots - List of project roots that are safe to scan
 * @param alreadyLoadedPaths - Set of paths that have already been loaded to avoid duplicates
 * @returns Discovery result containing files and concatenated instructions
 */
export async function loadJitContext(
  targetPath: string,
  trustedRoots: string[],
  alreadyLoadedPaths: Set<string> = new Set()
): Promise<DiscoveryResult> {
  const resolvedTarget = path.resolve(targetPath);
  let bestRoot: string | null = null;

  // Find the deepest trusted root that contains the target path
  for (const root of trustedRoots) {
    const resolvedRoot = path.resolve(root);
    if (
      resolvedTarget.startsWith(resolvedRoot) &&
      (!bestRoot || resolvedRoot.length > bestRoot.length)
    ) {
      bestRoot = resolvedRoot;
    }
  }

  if (!bestRoot) {
    return { files: [], instructions: '' };
  }

  const files: Array<{ path: string; content: string }> = [];
  let currentDir = resolvedTarget;

  // If target is a file, start from its directory
  try {
    const stats = await fs.stat(resolvedTarget);
    if (stats.isFile()) {
      currentDir = path.dirname(resolvedTarget);
    }
  } catch (_error) {
    // If path doesn't exist, we can't discover context
    return { files: [], instructions: '' };
  }

  // Traverse from target directory up to the trusted root
  while (currentDir.startsWith(bestRoot)) {
    const contextFiles = await findContextFiles(currentDir);

    for (const filePath of contextFiles) {
      if (!alreadyLoadedPaths.has(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          files.push({ path: filePath, content });
          alreadyLoadedPaths.add(filePath);
        } catch (_error) {
          console.warn(`Failed to read context file: ${filePath}`, _error);
        }
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
  }

  // Concatenate instructions
  const instructions = files
    .map((f) => `### Context from ${path.relative(bestRoot!, f.path)}\n\n${f.content}`)
    .join('\n\n---\n\n');

  return { files, instructions };
}

/**
 * Finds markdown files in a directory that likely contain context
 */
async function findContextFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) &&
          !entry.name.startsWith('.') // Skip hidden files
      )
      .map((entry) => path.join(dir, entry.name));
  } catch (_error) {
    return [];
  }
}
