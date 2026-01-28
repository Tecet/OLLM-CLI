/**
 * MCP Marketplace Service
 *
 * Provides access to the MCP server marketplace with caching,
 * search functionality, and installation capabilities.
 *
 * Connects to the official MCP Registry at registry.modelcontextprotocol.io
 */

import { mcpConfigService } from './mcpConfigService.js';

import type { MCPServerConfig } from '@ollm/ollm-cli-core/mcp/types.js';

/**
 * MCP marketplace server information
 */
export interface MCPMarketplaceServer {
  /** Unique server identifier */
  id: string;
  /** Display name */
  name: string;
  /** Server description */
  description: string;
  /** User rating (0-5) */
  rating: number;
  /** Number of installations */
  installCount: number;
  /** Whether OAuth is required */
  requiresOAuth: boolean;
  /** List of requirements (e.g., "Node.js 18+", "API Key") */
  requirements: string[];
  /** Command to execute the server */
  command: string;
  /** Command-line arguments */
  args?: string[];
  /** Environment variables needed */
  env?: Record<string, string>;
  /** Server category */
  category?: string;
  /** Server author */
  author?: string;
  /** Server version */
  version?: string;
  /** Server homepage URL */
  homepage?: string;
  /** Server repository URL */
  repository?: string;
}

/**
 * Registry API server response format (v0.1)
 */
interface RegistryServerWrapper {
  server: {
    $schema?: string;
    name: string;
    description: string;
    title?: string;
    version?: string;
    websiteUrl?: string;
    repository?: {
      url?: string;
      source?: string;
      subfolder?: string;
    };
    packages?: Array<{
      registryType?: string;
      identifier?: string;
      version?: string;
      runtimeHint?: string;
      registryBaseUrl?: string;
      transport?: {
        type?: string;
        url?: string;
      };
      environmentVariables?: Array<{
        name: string;
        description?: string;
        isSecret?: boolean;
        isRequired?: boolean;
        format?: string;
        placeholder?: string;
        default?: string;
      }>;
      packageArguments?: Array<{
        name?: string;
        type?: string;
        description?: string;
        isRequired?: boolean;
        value?: string;
      }>;
      runtimeArguments?: Array<{
        name?: string;
        type?: string;
        description?: string;
        isRequired?: boolean;
        value?: string;
      }>;
    }>;
    remotes?: Array<{
      type?: string;
      url?: string;
      headers?: Array<{
        name: string;
        description?: string;
        isSecret?: boolean;
        isRequired?: boolean;
        value?: string;
      }>;
    }>;
    _meta?: {
      'io.modelcontextprotocol.registry/publisher-provided'?: Record<string, unknown>;
    };
  };
  _meta?: {
    'io.modelcontextprotocol.registry/official'?: {
      status?: string;
      publishedAt?: string;
      updatedAt?: string;
      isLatest?: boolean;
    };
  };
}

interface RegistryResponse {
  servers: RegistryServerWrapper[];
  metadata?: {
    nextCursor?: string;
    count?: number;
  };
}

/**
 * MCP Marketplace Service
 *
 * Manages marketplace data with caching and provides search,
 * installation, and server discovery functionality.
 *
 * Connects to the official MCP Registry API v0.1
 */
export class MCPMarketplace {
  private cache: MCPMarketplaceServer[] = [];
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly MARKETPLACE_URL = 'https://registry.modelcontextprotocol.io/v0/servers';
  private readonly MARKETPLACE_DETAIL_URL = 'https://registry.modelcontextprotocol.io/v0/servers';

  /**
   * Search for servers in the marketplace
   * @param query - Search query (searches name and description)
   * @returns Array of matching servers
   */
  async searchServers(query: string): Promise<MCPMarketplaceServer[]> {
    if (!query || query.trim() === '') {
      return this.getAllServers();
    }

    try {
      // Try to search using the registry API (uses 'search' parameter for substring match on name)
      const response = await fetch(
        `${this.MARKETPLACE_URL}?search=${encodeURIComponent(query)}&limit=50&version=latest`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'OLLM-CLI/0.1.0',
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (response.ok) {
        const data: RegistryResponse = await response.json();

        if (data.servers && Array.isArray(data.servers)) {
          return data.servers
            .filter(
              (wrapper) =>
                wrapper.server &&
                wrapper._meta?.['io.modelcontextprotocol.registry/official']?.isLatest
            )
            .map((wrapper) => this.transformRegistryServer(wrapper));
        }
      }
    } catch (error) {
      console.warn('Failed to search registry, falling back to local search:', error);
    }

    // Fallback to local filtering
    const servers = await this.getAllServers();
    const lowerQuery = query.toLowerCase().trim();
    return servers.filter(
      (server) =>
        server.name.toLowerCase().includes(lowerQuery) ||
        server.description.toLowerCase().includes(lowerQuery) ||
        server.category?.toLowerCase().includes(lowerQuery) ||
        server.author?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get all servers from the marketplace
   * Uses cached data if available and not expired
   * @returns Array of all marketplace servers
   */
  async getAllServers(): Promise<MCPMarketplaceServer[]> {
    // Return cached data if still valid
    if (this.cache.length > 0 && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    try {
      // Attempt to fetch from official MCP Registry (only latest versions)
      const response = await fetch(`${this.MARKETPLACE_URL}?limit=100&version=latest`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'OLLM-CLI/0.1.0',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`Registry API returned ${response.status}: ${response.statusText}`);
      }

      const data: RegistryResponse = await response.json();

      if (!data.servers || !Array.isArray(data.servers)) {
        console.warn('Unexpected registry API response format:', data);
        throw new Error('Unexpected API response format');
      }

      // Transform registry format to our format
      const transformedServers = data.servers
        .filter(
          (wrapper) =>
            wrapper.server && wrapper._meta?.['io.modelcontextprotocol.registry/official']?.isLatest
        )
        .map((wrapper) => this.transformRegistryServer(wrapper));

      // Ensure certain canonical servers from local registry exist in results
      const requiredIds = ['filesystem', 'github', 'postgres'];
      const transformedIds = new Set(transformedServers.map((s) => s.id));
      const local = this.getLocalRegistry();
      for (const req of requiredIds) {
        if (!transformedIds.has(req)) {
          const found = local.find((s) => s.id === req);
          if (found) transformedServers.push(found);
        }
      }

      // Update cache
      this.cache = transformedServers;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      console.log(`Loaded ${transformedServers.length} servers from MCP Registry`);
      return transformedServers;
    } catch (error) {
      console.warn('Failed to fetch from MCP Registry, using local registry:', error);

      // Fallback to local registry
      const localServers = this.getLocalRegistry();

      // Update cache with local registry if empty
      if (this.cache.length === 0) {
        this.cache = localServers;
        this.cacheExpiry = Date.now() + this.CACHE_TTL;
      }

      return this.cache.length > 0 ? this.cache : localServers;
    }
  }

  /**
   * Get detailed information about a specific server
   * @param serverId - Server identifier
   * @returns Server details
   * @throws Error if server not found
   */
  async getServerDetails(serverId: string): Promise<MCPMarketplaceServer> {
    // First check cached/local data (faster and more reliable)
    const servers = await this.getAllServers();
    const cachedServer = servers.find((s) => s.id === serverId);

    if (cachedServer) {
      console.log(`Found server ${serverId} in cache`);
      return cachedServer;
    }

    console.log(`Server ${serverId} not in cache, trying API...`);
    console.log(`Available server IDs in cache:`, servers.map((s) => s.id).slice(0, 10));

    // If not in cache, try to fetch from registry
    try {
      const response = await fetch(
        `${this.MARKETPLACE_DETAIL_URL}/${encodeURIComponent(serverId)}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'OLLM-CLI/0.1.0',
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (response.ok) {
        const wrapper: RegistryServerWrapper = await response.json();
        const transformed = this.transformRegistryServer(wrapper);
        console.log(`Fetched server from API:`, transformed.id);
        return transformed;
      } else {
        console.warn(`API returned ${response.status} for ${serverId}`);
      }
    } catch (error) {
      console.warn(`Failed to fetch server ${serverId} from registry:`, error);
    }

    // Server not found anywhere
    throw new Error(`Server not found: ${serverId}`);
  }

  /**
   * Install a server from the marketplace
   * Adds the server to MCP configuration and saves it with metadata
   * @param serverOrId - Server object or server identifier
   * @param config - Server configuration (merged with marketplace defaults)
   * @throws Error if server not found or installation fails
   */
  async installServer(
    serverOrId: string | MCPMarketplaceServer,
    config: Partial<MCPServerConfig>
  ): Promise<void> {
    // Get server details (either from parameter or fetch)
    const server =
      typeof serverOrId === 'string' ? await this.getServerDetails(serverOrId) : serverOrId;

    // Detect if this is a remote server (has URL in repository)
    const isRemoteServer =
      server.repository?.startsWith('https://') &&
      server.command === 'node' &&
      server.args?.length === 0;

    // Build complete server configuration with metadata
    const serverConfig: MCPServerConfig = {
      command: config.command || server.command,
      args: config.args || server.args || [],
      env: {
        ...server.env,
        ...config.env,
      },
      // Use SSE transport for remote servers, stdio for local
      transport: config.transport || (isRemoteServer ? 'sse' : 'stdio'),
      timeout: config.timeout,
      oauth: config.oauth,
      // Set URL for remote servers
      url: config.url || (isRemoteServer ? server.repository : undefined),
      cwd: config.cwd,
      // Store metadata for offline access
      metadata: {
        description: server.description,
        author: server.author,
        category: server.category,
        version: server.version,
        homepage: server.homepage,
        repository: server.repository,
        rating: server.rating,
        installCount: server.installCount,
        requirements: server.requirements,
        requiresOAuth: server.requiresOAuth,
      },
    };

    // Note: We allow installation without API keys
    // Users can add them later by editing the server configuration

    // Add server to MCP configuration
    // Use server.id as the config key to ensure uniqueness and consistency
    await mcpConfigService.updateServerConfig(server.id, serverConfig);
  }

  /**
   * Get popular servers sorted by install count
   * @param limit - Maximum number of servers to return (default: 10)
   * @returns Array of popular servers
   */
  async getPopularServers(limit: number = 10): Promise<MCPMarketplaceServer[]> {
    const servers = await this.getAllServers();

    return servers.sort((a, b) => b.installCount - a.installCount).slice(0, limit);
  }

  /**
   * Get servers by category
   * @param category - Category name
   * @returns Array of servers in the category
   */
  async getServersByCategory(category: string): Promise<MCPMarketplaceServer[]> {
    const servers = await this.getAllServers();

    return servers.filter((server) => server.category?.toLowerCase() === category.toLowerCase());
  }

  /**
   * Refresh marketplace cache
   * Forces a fresh fetch from the marketplace API
   */
  async refreshCache(): Promise<void> {
    this.cache = [];
    this.cacheExpiry = 0;
    await this.getAllServers();
  }

  /**
   * Transform registry server to marketplace server format
   * @param wrapper - Registry server wrapper object
   * @returns Marketplace server object
   */
  private transformRegistryServer(wrapper: RegistryServerWrapper): MCPMarketplaceServer {
    const server = wrapper.server;

    // Normalize server ID and display name
    const rawId = server.name;
    const lastSegment = rawId.includes('/') ? rawId.split('/').pop() || rawId : rawId;
    const normalizedId = lastSegment.replace(/^mcp-/, '');

    // Extract server ID from name (normalized)
    const id = normalizedId;

    // Use title if available, otherwise use normalized id
    const name = server.title || normalizedId || server.name;

    // Determine category from name/description
    const category = this.getCategoryFromName(server.name, server.description);

    // Check if OAuth/auth is required
    const requiresOAuth =
      server.description.toLowerCase().includes('oauth') ||
      server.description.toLowerCase().includes('authentication');

    // Extract requirements
    const requirements: string[] = [];

    // Check for environment variables in packages
    const firstPackage = server.packages?.[0];
    if (firstPackage?.environmentVariables && firstPackage.environmentVariables.length > 0) {
      const requiredVars = firstPackage.environmentVariables.filter((v) => v.isRequired);
      const secretVars = firstPackage.environmentVariables.filter((v) => v.isSecret);

      if (requiredVars.length > 0) {
        requirements.push(`Required: ${requiredVars.map((v) => v.name).join(', ')}`);
      }
      if (secretVars.length > 0 && secretVars.length !== requiredVars.length) {
        requirements.push(`API Keys: ${secretVars.map((v) => v.name).join(', ')}`);
      }
    }

    // Check for environment variables in remotes
    const firstRemote = server.remotes?.[0];
    if (firstRemote?.headers && firstRemote.headers.length > 0) {
      const secretHeaders = firstRemote.headers.filter((h) => h.isSecret);
      if (secretHeaders.length > 0) {
        requirements.push(`Headers: ${secretHeaders.map((h) => h.name).join(', ')}`);
      }
    }

    // Add runtime hint if available
    if (firstPackage?.runtimeHint) {
      requirements.push(`Runtime: ${firstPackage.runtimeHint}`);
    }

    // Extract installation command
    let command = 'npx';
    let args: string[] = [];
    const env: Record<string, string> = {};

    if (firstPackage) {
      if (firstPackage.registryType === 'npm') {
        command = firstPackage.runtimeHint || 'npx';
        args = ['-y', firstPackage.identifier || server.name];

        // Add package arguments if specified
        if (firstPackage.packageArguments) {
          for (const arg of firstPackage.packageArguments) {
            if (arg.value) {
              args.push(arg.value);
            } else if (arg.name) {
              args.push(arg.name);
            }
          }
        }
      } else if (firstPackage.registryType === 'oci') {
        command = 'docker';
        args = ['run', '-i', firstPackage.identifier || server.name];
      }

      // Extract environment variables
      if (firstPackage.environmentVariables) {
        for (const envVar of firstPackage.environmentVariables) {
          env[envVar.name] = envVar.default || '';
        }
      }

      // Use transport type if specified
      if (firstPackage.transport?.type) {
        // Transport type will be used in config
      }
    } else if (firstRemote) {
      // Remote server - use SSE transport with URL
      // Remote servers don't use stdio, they connect via HTTP/SSE
      command = 'node'; // Placeholder, won't be used for SSE transport
      args = [];

      // Extract headers as environment variables
      if (firstRemote.headers) {
        for (const header of firstRemote.headers) {
          if (header.isSecret) {
            env[header.name] = '';
          }
        }
      }
    }

    // Extract author from name (first part before /)
    const author = server.name.includes('/')
      ? server.name.split('/')[0].replace(/^(io|com|org|ai)\./, '')
      : 'Unknown';

    // Extract version
    const version = server.version || firstPackage?.version || '0.1.0';

    // Default install count: try to infer from registry metadata, otherwise set to 1
    let inferredInstallCount = 1;
    try {
      const maybeCount = (wrapper as any)._meta?.count;
      if (typeof maybeCount === 'number' && maybeCount > 0) inferredInstallCount = maybeCount;
    } catch {
      /* no-op, ignore metadata parsing errors */
    }

    return {
      id,
      name,
      description: server.description,
      rating: 4.5, // Default rating (not provided by API)
      installCount: Math.max(1, inferredInstallCount),
      requiresOAuth,
      requirements,
      command,
      args,
      env: Object.keys(env).length > 0 ? env : undefined,
      category,
      author,
      version,
      homepage: server.websiteUrl || server.repository?.url,
      repository: server.repository?.url,
    };
  }

  /**
   * Determine category from server name and description
   * @param name - Server name
   * @param description - Server description
   * @returns Category name
   */
  private getCategoryFromName(name: string, description: string): string {
    const text = `${name} ${description}`.toLowerCase();

    const categoryPatterns: Array<[RegExp, string]> = [
      [/filesystem|files|storage|disk/, 'File System'],
      [/database|sql|postgres|mysql|sqlite|redis|mongo/, 'Database'],
      [/github|gitlab|git|api|dev/, 'Development'],
      [/web|http|fetch|request/, 'Web'],
      [/browser|puppeteer|playwright|automation/, 'Web Automation'],
      [/search|brave|google|bing/, 'Search'],
      [/slack|discord|email|communication|chat/, 'Communication'],
      [/cloud|drive|s3|storage/, 'Cloud Storage'],
      [/memory|context|cache|store/, 'Utilities'],
      [/ai|ml|llm|model|intelligence/, 'AI & ML'],
    ];

    for (const [pattern, category] of categoryPatterns) {
      if (pattern.test(text)) {
        return category;
      }
    }

    return 'Utilities';
  }

  /**
   * Determine category from tags (legacy method, kept for compatibility)
   * @param tags - Array of tags
   * @returns Category name
   */
  private getCategoryFromTags(tags: string[]): string {
    const categoryMap: Record<string, string> = {
      filesystem: 'File System',
      files: 'File System',
      storage: 'File System',
      database: 'Database',
      sql: 'Database',
      postgres: 'Database',
      postgresql: 'Database',
      sqlite: 'Database',
      mysql: 'Database',
      redis: 'Database',
      api: 'Development',
      github: 'Development',
      git: 'Development',
      gitlab: 'Development',
      web: 'Web',
      http: 'Web',
      fetch: 'Web',
      browser: 'Web Automation',
      puppeteer: 'Web Automation',
      playwright: 'Web Automation',
      search: 'Search',
      brave: 'Search',
      google: 'Search',
      communication: 'Communication',
      slack: 'Communication',
      discord: 'Communication',
      email: 'Communication',
      cloud: 'Cloud Storage',
      drive: 'Cloud Storage',
      s3: 'Cloud Storage',
      memory: 'Utilities',
      utility: 'Utilities',
      context: 'Utilities',
      ai: 'AI & ML',
      ml: 'AI & ML',
      llm: 'AI & ML',
    };

    for (const tag of tags) {
      const category = categoryMap[tag.toLowerCase()];
      if (category) return category;
    }

    return 'Utilities';
  }

  /**
   * Get local registry of popular MCP servers
   * Used as fallback when marketplace API is unavailable
   * @returns Array of local registry servers
   */
  private getLocalRegistry(): MCPMarketplaceServer[] {
    return [
      // Real servers from MCP Registry for testing
      {
        id: 'io.github.upstash/context7',
        name: 'context7',
        description: 'Up-to-date code docs for any prompt',
        rating: 4.9,
        installCount: 2500,
        requiresOAuth: false,
        requirements: ['Node.js 18+', 'Context7 API Key'],
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp'],
        env: {
          CONTEXT7_API_KEY: '',
        },
        category: 'AI & ML',
        author: 'Upstash',
        version: '1.0.31',
        repository: 'https://github.com/upstash/context7',
      },
      {
        id: 'ai.smithery/brave',
        name: 'brave-search',
        description: 'Search the web, local businesses, images, and more with Brave Search API',
        rating: 4.7,
        installCount: 3500,
        requiresOAuth: false,
        requirements: ['Smithery API Key', 'Brave Search API Key'],
        command: 'mcp-remote',
        args: ['https://server.smithery.ai/brave/mcp'],
        env: {
          SMITHERY_API_KEY: '',
          BRAVE_API_KEY: '',
        },
        category: 'Search',
        author: 'Smithery',
        version: '2.0.58',
        repository: 'https://github.com/brave/brave-search-mcp-server',
      },
      {
        id: 'ai.autoblocks/contextlayer-mcp',
        name: 'contextlayer',
        description: 'Personal context management for AI assistants',
        rating: 4.6,
        installCount: 1500,
        requiresOAuth: false,
        requirements: ['Node.js 18+'],
        command: 'npx',
        args: ['-y', '@contextlayer/mcp'],
        category: 'AI & ML',
        author: 'Autoblocks',
        version: '0.0.3',
        repository: 'https://github.com/autoblocksai/ctxl',
      },
      {
        id: 'ai.exa/exa',
        name: 'exa-search',
        description: 'Exa AI-powered search - Advanced web search with AI understanding',
        rating: 4.8,
        installCount: 3200,
        requiresOAuth: false,
        requirements: ['Node.js 18+', 'Exa API Key'],
        command: 'npx',
        args: ['-y', '@exa/mcp-server'],
        env: {
          EXA_API_KEY: '',
        },
        category: 'Search',
        author: 'Exa',
        version: '0.1.0',
        repository: 'https://github.com/exa-labs/mcp-server',
      },
      // Official Anthropic servers
      {
        id: 'filesystem',
        name: 'filesystem',
        description: 'Secure file system operations with configurable access controls',
        rating: 5,
        installCount: 10000,
        requiresOAuth: false,
        requirements: ['Node.js 18+'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
        category: 'File System',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'github',
        name: 'github',
        description: 'GitHub API integration for repository management and operations',
        rating: 4.8,
        installCount: 8500,
        requiresOAuth: true,
        requirements: ['Node.js 18+', 'GitHub Personal Access Token'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: '',
        },
        category: 'Development',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'postgres',
        name: 'postgres',
        description: 'PostgreSQL database integration with query execution and schema inspection',
        rating: 4.7,
        installCount: 7200,
        requiresOAuth: false,
        requirements: ['Node.js 18+', 'PostgreSQL connection string'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: {
          POSTGRES_CONNECTION_STRING: '',
        },
        category: 'Database',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'slack',
        name: 'slack',
        description: 'Slack workspace integration for messaging and channel management',
        rating: 4.6,
        installCount: 6800,
        requiresOAuth: true,
        requirements: ['Node.js 18+', 'Slack Bot Token'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: {
          SLACK_BOT_TOKEN: '',
        },
        category: 'Communication',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'google-drive',
        name: 'google-drive',
        description: 'Google Drive integration for file management and sharing',
        rating: 4.5,
        installCount: 6200,
        requiresOAuth: true,
        requirements: ['Node.js 18+', 'Google OAuth credentials'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-google-drive'],
        category: 'Cloud Storage',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'puppeteer',
        name: 'puppeteer',
        description: 'Browser automation and web scraping with Puppeteer',
        rating: 4.7,
        installCount: 5900,
        requiresOAuth: false,
        requirements: ['Node.js 18+', 'Chromium (auto-installed)'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer'],
        category: 'Web Automation',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'brave-search',
        name: 'brave-search',
        description: 'Web search using Brave Search API',
        rating: 4.4,
        installCount: 5500,
        requiresOAuth: false,
        requirements: ['Node.js 18+', 'Brave Search API Key'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
          BRAVE_API_KEY: '',
        },
        category: 'Search',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'memory',
        name: 'memory',
        description: 'Persistent memory storage for conversation context',
        rating: 4.8,
        installCount: 5200,
        requiresOAuth: false,
        requirements: ['Node.js 18+'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        category: 'Utilities',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'sqlite',
        name: 'sqlite',
        description: 'SQLite database operations and query execution',
        rating: 4.6,
        installCount: 4800,
        requiresOAuth: false,
        requirements: ['Node.js 18+', 'SQLite database file path'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite', '/path/to/database.db'],
        category: 'Database',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
      {
        id: 'fetch',
        name: 'fetch',
        description: 'HTTP requests and web content fetching',
        rating: 4.5,
        installCount: 4500,
        requiresOAuth: false,
        requirements: ['Node.js 18+'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-fetch'],
        category: 'Web',
        author: 'Anthropic',
        version: '0.1.0',
        repository: 'https://github.com/modelcontextprotocol/servers',
      },
    ];
  }
}

// Singleton instance
export const mcpMarketplace = new MCPMarketplace();
