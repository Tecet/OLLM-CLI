/**
 * Planning Mode File and Directory Restrictions
 * 
 * Defines which file types and directories are allowed for write operations
 * in planning mode. Planning mode is for design and documentation, not code.
 */

/**
 * File extensions allowed for writing in planning mode
 */
export const ALLOWED_FILE_EXTENSIONS = [
  // Documentation
  '.md',
  '.txt',
  '.adr',
  '.adoc',
  '.rst',
  
  // Diagrams
  '.mermaid',
  '.plantuml',
  '.drawio',
  '.excalidraw',
  '.puml',
  '.dot',
  
  // Design documents
  '.spec',
  '.design',
  '.requirements',
  '.architecture'
] as const;

/**
 * File extensions denied for writing in planning mode
 */
export const DENIED_FILE_EXTENSIONS = [
  // Source code
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp',
  '.go', '.rs', '.swift', '.kt', '.scala',
  '.php', '.cs', '.vb', '.fs',
  
  // Configuration
  '.json', '.yaml', '.yml', '.toml', '.ini', '.env',
  '.config', '.conf',
  
  // Database
  '.sql', '.prisma', '.graphql', '.gql',
  
  // Scripts
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  
  // Build/Package
  '.lock', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  
  // Compiled/Binary
  '.wasm', '.dll', '.so', '.dylib', '.exe'
] as const;

/**
 * Directory patterns allowed for writing in planning mode
 * Supports glob patterns with wildcards
 */
export const ALLOWED_DIRECTORY_PATTERNS = [
  // Documentation directories
  'docs/**',
  '.docs/**',
  'documentation/**',
  'doc/**',
  
  // Design directories
  'design/**',
  'designs/**',
  'specs/**',
  '.specs/**',
  'specifications/**',
  
  // Architecture Decision Records
  'adr/**',
  '.adr/**',
  'adrs/**',
  
  // Planning directories
  'planning/**',
  'plans/**',
  
  // Kiro-specific directories
  '.kiro/specs/**',
  '.kiro/plan_draft/**'
] as const;

/**
 * Directory patterns denied for writing in planning mode
 * Supports glob patterns with wildcards
 */
export const DENIED_DIRECTORY_PATTERNS = [
  // Source code directories
  'src/**',
  'lib/**',
  'packages/**',
  'app/**',
  'components/**',
  'pages/**',
  'routes/**',
  'controllers/**',
  'models/**',
  'views/**',
  'services/**',
  'utils/**',
  'helpers/**',
  'middleware/**',
  
  // Build/Distribution
  'dist/**',
  'build/**',
  'out/**',
  'target/**',
  '.next/**',
  
  // Dependencies
  'node_modules/**',
  'vendor/**',
  
  // Configuration roots (but allow nested docs)
  'config/**',
  '.config/**',
  
  // Database
  'migrations/**',
  'seeds/**',
  'prisma/**',
  
  // Scripts
  'scripts/**',
  'bin/**',
  
  // Tests (planning shouldn't write tests)
  'test/**',
  'tests/**',
  '__tests__/**',
  '**/*.test.*',
  '**/*.spec.*'
] as const;

/**
 * Check if a file extension is allowed in planning mode
 */
export function isFileExtensionAllowed(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  
  // Check if explicitly allowed
  if (ALLOWED_FILE_EXTENSIONS.includes(ext as (typeof ALLOWED_FILE_EXTENSIONS)[number])) {
    return true;
  }
  
  // Check if explicitly denied
  if (DENIED_FILE_EXTENSIONS.includes(ext as (typeof DENIED_FILE_EXTENSIONS)[number])) {
    return false;
  }
  
  // Default: deny unknown extensions in planning mode
  return false;
}

/**
 * Check if a directory is allowed in planning mode
 */
export function isDirectoryAllowed(filePath: string): boolean {
  const normalizedPath = normalizePath(filePath);
  
  // Check if path matches any denied pattern first (denied takes precedence)
  const isDenied = DENIED_DIRECTORY_PATTERNS.some(pattern => 
    matchesPattern(normalizedPath, pattern)
  );
  
  if (isDenied) {
    return false;
  }
  
  // Check if path matches any allowed pattern
  const isAllowed = ALLOWED_DIRECTORY_PATTERNS.some(pattern => 
    matchesPattern(normalizedPath, pattern)
  );
  
  return isAllowed;
}

/**
 * Check if a file path is allowed for writing in planning mode
 * Combines both extension and directory checks
 */
export function isFileAllowedInPlanningMode(filePath: string): boolean {
  return isFileExtensionAllowed(filePath) && isDirectoryAllowed(filePath);
}

/**
 * Get a helpful error message for restricted files
 */
export function getRestrictionErrorMessage(filePath: string): string {
  const ext = getFileExtension(filePath);
  const normalizedPath = normalizePath(filePath);
  
  // Check extension first
  if (DENIED_FILE_EXTENSIONS.includes(ext as (typeof DENIED_FILE_EXTENSIONS)[number])) {
    return `Planning mode cannot write to source code files (${ext}). ` +
           `Switch to Developer mode to modify code. ` +
           `Planning mode is for documentation and design only.`;
  }
  
  // Check directory
  const deniedPattern = DENIED_DIRECTORY_PATTERNS.find(pattern => 
    matchesPattern(normalizedPath, pattern)
  );
  
  if (deniedPattern) {
    const dirName = deniedPattern.replace('/**', '').replace('**/', '');
    return `Planning mode cannot write to ${dirName} directory. ` +
           `Switch to Developer mode to modify code. ` +
           `Planning mode can only write to documentation and design directories.`;
  }
  
  // Check if it's not in an allowed directory
  const isInAllowedDir = ALLOWED_DIRECTORY_PATTERNS.some(pattern => 
    matchesPattern(normalizedPath, pattern)
  );
  
  if (!isInAllowedDir) {
    return `Planning mode can only write to documentation and design directories. ` +
           `Allowed directories: docs/, design/, specs/, adr/, planning/, .kiro/specs/. ` +
           `Switch to Developer mode to modify files in other directories.`;
  }
  
  // Unknown extension
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext as (typeof ALLOWED_FILE_EXTENSIONS)[number])) {
    return `Planning mode cannot write to ${ext} files. ` +
           `Allowed file types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}. ` +
           `Switch to Developer mode for code changes.`;
  }
  
  // Generic message
  return `Planning mode cannot write to this file. ` +
         `Planning mode is restricted to documentation and design files in specific directories. ` +
         `Switch to Developer mode to modify code.`;
}

/**
 * Get file extension from path (including the dot)
 */
function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  
  // No extension or dot is part of directory name
  if (lastDot === -1 || lastDot < lastSlash) {
    return '';
  }
  
  return filePath.substring(lastDot).toLowerCase();
}

/**
 * Normalize file path for consistent matching
 */
function normalizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/') // Convert backslashes to forward slashes
    .replace(/^\.\//, '') // Remove leading ./
    .toLowerCase();
}

/**
 * Match a path against a glob pattern
 * Supports ** for recursive matching and * for single-level wildcards
 */
function matchesPattern(path: string, pattern: string): boolean {
  const normalizedPattern = pattern.toLowerCase();
  
  // Handle ** patterns (e.g., "docs/**")
  if (normalizedPattern.includes('**')) {
    // Extract the prefix before /**
    const prefix = normalizedPattern.replace('/**', '');
    
    // Check if path starts with the prefix
    if (path.startsWith(prefix + '/') || path === prefix) {
      return true;
    }
    
    // Also check if path contains the prefix as a directory
    return path.includes('/' + prefix + '/') || path.startsWith(prefix + '/');
  }
  
  // For patterns without **, do exact matching with * wildcards
  const regexPattern = normalizedPattern
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\//g, '\\/'); // Escape slashes
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}
