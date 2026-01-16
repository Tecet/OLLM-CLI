/**
 * Extension Registry for marketplace functionality
 * 
 * Provides extension discovery, installation, and integrity verification
 * from remote sources (GitHub, npm, etc.)
 */

import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { homedir } from 'os';

/**
 * Extension metadata from registry
 */
export interface ExtensionMetadata {
  /** Extension name */
  name: string;
  /** Extension version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Author name */
  author: string;
  /** Repository URL */
  repository: string;
  /** Download URL (tarball or zip) */
  downloadUrl: string;
  /** SHA-256 checksum for integrity verification */
  checksum: string;
  /** Tags for categorization */
  tags: string[];
  /** Download count */
  downloads: number;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Extension search result
 */
export interface ExtensionSearchResult {
  /** Extension metadata */
  metadata: ExtensionMetadata;
  /** Match score (0-1) */
  score: number;
}

/**
 * Extension installation result
 */
export interface ExtensionInstallResult {
  /** Extension name */
  name: string;
  /** Installed version */
  version: string;
  /** Installation path */
  path: string;
  /** Whether installation was successful */
  success: boolean;
  /** Error message if installation failed */
  error?: string;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Registry URL (default: GitHub-based registry) */
  registryUrl?: string;
  /** Installation directory */
  installDir?: string;
  /** Whether to verify checksums */
  verifyChecksums?: boolean;
}

/**
 * Extension registry for marketplace functionality
 */
export class ExtensionRegistry {
  private registryUrl: string;
  private installDir: string;
  private verifyChecksums: boolean;
  private cache: Map<string, ExtensionMetadata[]>;
  private cacheExpiry: number;
  private lastCacheUpdate: number;

  constructor(config: RegistryConfig = {}) {
    this.registryUrl = config.registryUrl || 'https://raw.githubusercontent.com/ollm-cli/extensions-registry/main/registry.json';
    this.installDir = config.installDir || join(homedir(), '.ollm', 'extensions');
    this.verifyChecksums = config.verifyChecksums ?? true;
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.lastCacheUpdate = 0;
  }

  /**
   * Search for extensions in the registry
   * 
   * @param query - Search query (name, description, tags)
   * @param options - Search options
   * @returns Array of search results sorted by relevance
   */
  async search(
    query: string,
    options: {
      limit?: number;
      tags?: string[];
      sortBy?: 'relevance' | 'downloads' | 'updated';
    } = {}
  ): Promise<ExtensionSearchResult[]> {
    const { limit = 20, tags, sortBy = 'relevance' } = options;

    // Fetch registry data
    const extensions = await this.fetchRegistry();

    // Filter by tags if specified
    let filtered = extensions;
    if (tags && tags.length > 0) {
      filtered = extensions.filter((ext) =>
        tags.some((tag) => ext.tags.includes(tag))
      );
    }

    // Search and score
    const results: ExtensionSearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const ext of filtered) {
      let score = 0;

      // Exact name match
      if (ext.name.toLowerCase() === queryLower) {
        score += 1.0;
      }
      // Name contains query
      else if (ext.name.toLowerCase().includes(queryLower)) {
        score += 0.8;
      }

      // Description contains query
      if (ext.description.toLowerCase().includes(queryLower)) {
        score += 0.5;
      }

      // Tags contain query
      if (ext.tags.some((tag) => tag.toLowerCase().includes(queryLower))) {
        score += 0.3;
      }

      // Author contains query
      if (ext.author.toLowerCase().includes(queryLower)) {
        score += 0.2;
      }

      if (score > 0) {
        results.push({ metadata: ext, score });
      }
    }

    // Sort results
    if (sortBy === 'relevance') {
      results.sort((a, b) => b.score - a.score);
    } else if (sortBy === 'downloads') {
      results.sort((a, b) => b.metadata.downloads - a.metadata.downloads);
    } else if (sortBy === 'updated') {
      results.sort(
        (a, b) =>
          new Date(b.metadata.updatedAt).getTime() -
          new Date(a.metadata.updatedAt).getTime()
      );
    }

    // Limit results
    return results.slice(0, limit);
  }

  /**
   * Get extension metadata by name
   * 
   * @param name - Extension name
   * @returns Extension metadata or undefined if not found
   */
  async getExtension(name: string): Promise<ExtensionMetadata | undefined> {
    const extensions = await this.fetchRegistry();
    return extensions.find((ext) => ext.name === name);
  }

  /**
   * Install an extension from the registry
   * 
   * @param name - Extension name
   * @param version - Optional version (defaults to latest)
   * @returns Installation result
   */
  async install(
    name: string,
    version?: string
  ): Promise<ExtensionInstallResult> {
    try {
      // Get extension metadata
      const metadata = await this.getExtension(name);
      if (!metadata) {
        return {
          name,
          version: version || 'unknown',
          path: '',
          success: false,
          error: `Extension '${name}' not found in registry`,
        };
      }

      // Check version if specified
      if (version && metadata.version !== version) {
        return {
          name,
          version: version,
          path: '',
          success: false,
          error: `Version '${version}' not available. Latest version is ${metadata.version}`,
        };
      }

      // Download extension
      console.log(`Downloading extension '${name}' v${metadata.version}...`);
      const downloadPath = await this.downloadExtension(metadata);

      // Verify checksum
      if (this.verifyChecksums) {
        console.log('Verifying checksum...');
        const valid = await this.verifyChecksum(downloadPath, metadata.checksum);
        if (!valid) {
          // Clean up downloaded file
          await rm(downloadPath, { force: true });
          return {
            name,
            version: metadata.version,
            path: '',
            success: false,
            error: 'Checksum verification failed',
          };
        }
      }

      // Extract extension
      console.log('Extracting extension...');
      const installPath = await this.extractExtension(downloadPath, name);

      // Clean up downloaded file
      await rm(downloadPath, { force: true });

      console.log(`Successfully installed extension '${name}' v${metadata.version}`);

      return {
        name,
        version: metadata.version,
        path: installPath,
        success: true,
      };
    } catch (error) {
      return {
        name,
        version: version || 'unknown',
        path: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Uninstall an extension
   * 
   * @param name - Extension name
   */
  async uninstall(name: string): Promise<void> {
    const extensionPath = join(this.installDir, name);
    await rm(extensionPath, { recursive: true, force: true });
    console.log(`Uninstalled extension '${name}'`);
  }

  /**
   * Check for extension updates
   * 
   * @param name - Extension name
   * @param currentVersion - Current installed version
   * @returns New version if update available, undefined otherwise
   */
  async checkUpdate(
    name: string,
    currentVersion: string
  ): Promise<string | undefined> {
    const metadata = await this.getExtension(name);
    if (!metadata) {
      return undefined;
    }

    // Simple version comparison (assumes semantic versioning)
    if (this.compareVersions(metadata.version, currentVersion) > 0) {
      return metadata.version;
    }

    return undefined;
  }

  /**
   * List all available extensions
   * 
   * @returns Array of all extension metadata
   */
  async listAll(): Promise<ExtensionMetadata[]> {
    return this.fetchRegistry();
  }

  /**
   * Fetch registry data from remote source
   * 
   * @returns Array of extension metadata
   */
  private async fetchRegistry(): Promise<ExtensionMetadata[]> {
    // Check cache
    const now = Date.now();
    if (
      this.cache.has('registry') &&
      now - this.lastCacheUpdate < this.cacheExpiry
    ) {
      return this.cache.get('registry')!;
    }

    try {
      // Fetch from registry URL
      const response = await fetch(this.registryUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch registry: ${response.statusText}`);
      }

      const data = await response.json();
      const extensions = data.extensions as ExtensionMetadata[];

      // Update cache
      this.cache.set('registry', extensions);
      this.lastCacheUpdate = now;

      return extensions;
    } catch (error) {
      // Return cached data if available, even if expired
      if (this.cache.has('registry')) {
        console.warn('Using cached registry data due to fetch error');
        return this.cache.get('registry')!;
      }

      throw new Error(
        `Failed to fetch registry: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Download extension from URL
   * 
   * @param metadata - Extension metadata
   * @returns Path to downloaded file
   */
  private async downloadExtension(
    metadata: ExtensionMetadata
  ): Promise<string> {
    const response = await fetch(metadata.downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download extension: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const downloadPath = join(
      this.installDir,
      `${metadata.name}-${metadata.version}.tar.gz`
    );

    // Ensure install directory exists
    await mkdir(this.installDir, { recursive: true });

    // Write downloaded file
    await writeFile(downloadPath, Buffer.from(buffer));

    return downloadPath;
  }

  /**
   * Verify file checksum
   * 
   * @param filePath - Path to file
   * @param expectedChecksum - Expected SHA-256 checksum
   * @returns True if checksum matches, false otherwise
   */
  private async verifyChecksum(
    filePath: string,
    expectedChecksum: string
  ): Promise<boolean> {
    const content = await readFile(filePath);
    const hash = createHash('sha256');
    hash.update(content);
    const actualChecksum = hash.digest('hex');

    return actualChecksum === expectedChecksum;
  }

  /**
   * Extract extension archive
   * 
   * @param archivePath - Path to archive file
   * @param name - Extension name
   * @returns Path to extracted extension
   */
  private async extractExtension(
    archivePath: string,
    name: string
  ): Promise<string> {
    const extractPath = join(this.installDir, name);

    // Ensure extraction directory exists
    await mkdir(extractPath, { recursive: true });

    // TODO: Implement actual extraction logic
    // For now, this is a placeholder
    // In production, use tar or unzipper library
    throw new Error('Extension extraction not yet implemented');
  }

  /**
   * Compare semantic versions
   * 
   * @param v1 - First version
   * @param v2 - Second version
   * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }

  /**
   * Clear registry cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastCacheUpdate = 0;
  }
}
