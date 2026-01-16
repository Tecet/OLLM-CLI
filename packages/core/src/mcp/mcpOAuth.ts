/**
 * OAuth 2.0 Provider for MCP Servers
 * 
 * Handles OAuth authentication flow for remote MCP servers,
 * including token storage, refresh, and automatic discovery.
 */

import { createServer, type Server } from 'http';
import { parse as parseUrl } from 'url';

/**
 * OAuth configuration for an MCP server
 */
export interface OAuthConfig {
  /** Whether OAuth is enabled */
  enabled: boolean;
  /** Authorization endpoint URL (can be auto-discovered) */
  authorizationUrl?: string;
  /** Token endpoint URL (can be auto-discovered) */
  tokenUrl?: string;
  /** Client ID */
  clientId: string;
  /** Client secret (optional for PKCE flow) */
  clientSecret?: string;
  /** OAuth scopes */
  scopes?: string[];
  /** Local redirect port (default: 3000) */
  redirectPort?: number;
  /** Use PKCE flow (default: true) */
  usePKCE?: boolean;
}

/**
 * OAuth tokens
 */
export interface OAuthTokens {
  /** Access token */
  accessToken: string;
  /** Refresh token (optional) */
  refreshToken?: string;
  /** Token expiration timestamp */
  expiresAt: number;
  /** Token type (usually "Bearer") */
  tokenType: string;
  /** Granted scopes */
  scope?: string;
}

/**
 * OAuth discovery information from server
 */
interface OAuthDiscovery {
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
}

/**
 * OAuth provider for MCP servers
 */
export class MCPOAuthProvider {
  private tokens: Map<string, OAuthTokens> = new Map();
  private tokenStorage?: TokenStorage;

  constructor(tokenStorage?: TokenStorage) {
    this.tokenStorage = tokenStorage;
  }

  /**
   * Authenticate with an MCP server using OAuth
   * 
   * @param serverName - Name of the server
   * @param config - OAuth configuration
   * @returns OAuth tokens
   */
  async authenticate(serverName: string, config: OAuthConfig): Promise<OAuthTokens> {
    // Check if we have valid cached tokens
    const cached = await this.getValidTokens(serverName);
    if (cached) {
      return cached;
    }

    // Start OAuth flow
    const tokens = await this.startOAuthFlow(serverName, config);

    // Store tokens
    await this.storeTokens(serverName, tokens);

    return tokens;
  }

  /**
   * Get valid tokens for a server (refresh if needed)
   * 
   * @param serverName - Name of the server
   * @returns Valid tokens or undefined
   */
  async getValidTokens(serverName: string): Promise<OAuthTokens | undefined> {
    // Try memory cache first
    let tokens = this.tokens.get(serverName);

    // Try storage if not in memory
    if (!tokens && this.tokenStorage) {
      tokens = await this.tokenStorage.getTokens(serverName);
      if (tokens) {
        this.tokens.set(serverName, tokens);
      }
    }

    if (!tokens) {
      return undefined;
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const expiresWithBuffer = tokens.expiresAt - 5 * 60 * 1000;

    if (now >= expiresWithBuffer) {
      // Token expired, try to refresh
      if (tokens.refreshToken) {
        try {
          const refreshed = await this.refreshTokens(serverName, tokens.refreshToken);
          await this.storeTokens(serverName, refreshed);
          return refreshed;
        } catch (error) {
          // Refresh failed, remove invalid tokens
          await this.revokeTokens(serverName);
          return undefined;
        }
      }
      
      // No refresh token, tokens are invalid
      await this.revokeTokens(serverName);
      return undefined;
    }

    return tokens;
  }

  /**
   * Refresh OAuth tokens
   * 
   * @param serverName - Name of the server
   * @param refreshToken - Refresh token
   * @returns New tokens
   */
  async refreshTokens(serverName: string, refreshToken: string): Promise<OAuthTokens> {
    // Get stored config (would need to be passed or stored)
    // For now, throw error - this needs server config
    throw new Error('Token refresh not yet implemented - needs server config');
  }

  /**
   * Revoke tokens for a server
   * 
   * @param serverName - Name of the server
   */
  async revokeTokens(serverName: string): Promise<void> {
    this.tokens.delete(serverName);
    
    if (this.tokenStorage) {
      await this.tokenStorage.deleteTokens(serverName);
    }
  }

  /**
   * Start OAuth authorization flow
   * 
   * @param serverName - Name of the server
   * @param config - OAuth configuration
   * @returns OAuth tokens
   */
  private async startOAuthFlow(serverName: string, config: OAuthConfig): Promise<OAuthTokens> {
    const redirectPort = config.redirectPort ?? 3000;
    const redirectUri = `http://localhost:${redirectPort}/callback`;
    const usePKCE = config.usePKCE ?? true;

    // Generate PKCE challenge if enabled
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

    if (usePKCE) {
      codeVerifier = this.generateCodeVerifier();
      codeChallenge = await this.generateCodeChallenge(codeVerifier);
    }

    // Build authorization URL
    const authUrl = new URL(config.authorizationUrl!);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', (config.scopes || []).join(' '));

    if (usePKCE && codeChallenge) {
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    // Start local server to receive callback
    const authCode = await this.startCallbackServer(redirectPort, authUrl.toString());

    // Exchange authorization code for tokens
    const tokens = await this.exchangeCodeForTokens(
      config,
      authCode,
      redirectUri,
      codeVerifier
    );

    return tokens;
  }

  /**
   * Start local HTTP server to receive OAuth callback
   * 
   * @param port - Port to listen on
   * @param authUrl - Authorization URL to open
   * @returns Authorization code
   */
  private async startCallbackServer(port: number, authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let server: Server | undefined;
      const timeout = setTimeout(() => {
        server?.close();
        reject(new Error('OAuth callback timeout'));
      }, 5 * 60 * 1000); // 5 minute timeout

      server = createServer((req, res) => {
        const url = parseUrl(req.url || '', true);

        if (url.pathname === '/callback') {
          const code = url.query.code as string;
          const error = url.query.error as string;

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<html><body><h1>Authentication Failed</h1><p>${error}</p></body></html>`);
            clearTimeout(timeout);
            server?.close();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>Authentication Successful</h1><p>You can close this window.</p></body></html>');
            clearTimeout(timeout);
            server?.close();
            resolve(code);
            return;
          }

          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Invalid Request</h1></body></html>');
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      server.listen(port, () => {
        console.log(`OAuth callback server listening on http://localhost:${port}`);
        console.log(`Opening browser for authentication...`);
        console.log(`Authorization URL: ${authUrl}`);
        
        // Open browser (platform-specific)
        this.openBrowser(authUrl);
      });

      server.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Exchange authorization code for tokens
   * 
   * @param config - OAuth configuration
   * @param code - Authorization code
   * @param redirectUri - Redirect URI
   * @param codeVerifier - PKCE code verifier
   * @returns OAuth tokens
   */
  private async exchangeCodeForTokens(
    config: OAuthConfig,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
    });

    if (config.clientSecret) {
      body.set('client_secret', config.clientSecret);
    }

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(config.tokenUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json() as any;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
    };
  }

  /**
   * Store tokens
   * 
   * @param serverName - Server name
   * @param tokens - Tokens to store
   */
  private async storeTokens(serverName: string, tokens: OAuthTokens): Promise<void> {
    this.tokens.set(serverName, tokens);

    if (this.tokenStorage) {
      await this.tokenStorage.storeTokens(serverName, tokens);
    }
  }

  /**
   * Generate PKCE code verifier
   * 
   * @returns Code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * Generate PKCE code challenge from verifier
   * 
   * @param verifier - Code verifier
   * @returns Code challenge
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(hash));
  }

  /**
   * Base64 URL encode
   * 
   * @param buffer - Buffer to encode
   * @returns Base64 URL encoded string
   */
  private base64UrlEncode(buffer: Uint8Array): string {
    const base64 = Buffer.from(buffer).toString('base64');
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Open browser (platform-specific)
   * 
   * @param url - URL to open
   */
  private openBrowser(url: string): void {
    const { exec } = require('child_process');
    const platform = process.platform;

    let command: string;
    if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else if (platform === 'darwin') {
      command = `open "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    exec(command, (error: Error | null) => {
      if (error) {
        console.error('Failed to open browser:', error);
        console.log('Please open this URL manually:', url);
      }
    });
  }

  /**
   * Discover OAuth configuration from server
   * 
   * @param serverUrl - Server URL
   * @returns OAuth discovery information
   */
  static async discoverOAuth(serverUrl: string): Promise<OAuthDiscovery | undefined> {
    try {
      // Try to fetch OAuth discovery endpoint
      const discoveryUrl = new URL('/.well-known/oauth-authorization-server', serverUrl);
      const response = await fetch(discoveryUrl.toString());

      if (!response.ok) {
        return undefined;
      }

      const data = await response.json() as any;

      return {
        authorizationUrl: data.authorization_endpoint,
        tokenUrl: data.token_endpoint,
        scopes: data.scopes_supported,
      };
    } catch {
      return undefined;
    }
  }
}

/**
 * Token storage interface
 */
export interface TokenStorage {
  /**
   * Get tokens for a server
   * 
   * @param serverName - Server name
   * @returns Tokens or undefined
   */
  getTokens(serverName: string): Promise<OAuthTokens | undefined>;

  /**
   * Store tokens for a server
   * 
   * @param serverName - Server name
   * @param tokens - Tokens to store
   */
  storeTokens(serverName: string, tokens: OAuthTokens): Promise<void>;

  /**
   * Delete tokens for a server
   * 
   * @param serverName - Server name
   */
  deleteTokens(serverName: string): Promise<void>;
}

/**
 * File-based token storage (fallback if keytar not available)
 */
export class FileTokenStorage implements TokenStorage {
  private tokensFile: string;

  constructor(tokensFile: string) {
    this.tokensFile = tokensFile;
  }

  async getTokens(serverName: string): Promise<OAuthTokens | undefined> {
    try {
      const { readFile } = await import('fs/promises');
      const content = await readFile(this.tokensFile, 'utf-8');
      const allTokens = JSON.parse(content);
      return allTokens[serverName];
    } catch {
      return undefined;
    }
  }

  async storeTokens(serverName: string, tokens: OAuthTokens): Promise<void> {
    const { readFile, writeFile, mkdir } = await import('fs/promises');
    const { dirname } = await import('path');

    // Ensure directory exists
    await mkdir(dirname(this.tokensFile), { recursive: true });

    // Read existing tokens
    let allTokens: Record<string, OAuthTokens> = {};
    try {
      const content = await readFile(this.tokensFile, 'utf-8');
      allTokens = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    // Update tokens
    allTokens[serverName] = tokens;

    // Write back
    await writeFile(this.tokensFile, JSON.stringify(allTokens, null, 2), 'utf-8');
  }

  async deleteTokens(serverName: string): Promise<void> {
    const { readFile, writeFile } = await import('fs/promises');

    try {
      const content = await readFile(this.tokensFile, 'utf-8');
      const allTokens = JSON.parse(content);
      delete allTokens[serverName];
      await writeFile(this.tokensFile, JSON.stringify(allTokens, null, 2), 'utf-8');
    } catch {
      // File doesn't exist, nothing to delete
    }
  }
}

/**
 * Keytar-based token storage (secure, platform keychain)
 */
export class KeytarTokenStorage implements TokenStorage {
  private service = 'ollm-cli-mcp';

  async getTokens(serverName: string): Promise<OAuthTokens | undefined> {
    try {
      const keytar = await import('keytar');
      const json = await keytar.getPassword(this.service, serverName);
      return json ? JSON.parse(json) : undefined;
    } catch {
      return undefined;
    }
  }

  async storeTokens(serverName: string, tokens: OAuthTokens): Promise<void> {
    try {
      const keytar = await import('keytar');
      await keytar.setPassword(this.service, serverName, JSON.stringify(tokens));
    } catch (error) {
      throw new Error(`Failed to store tokens securely: ${error}`);
    }
  }

  async deleteTokens(serverName: string): Promise<void> {
    try {
      const keytar = await import('keytar');
      await keytar.deletePassword(this.service, serverName);
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Create appropriate token storage based on availability
 * 
 * @param fallbackFile - Fallback file path if keytar not available
 * @returns Token storage instance
 */
export async function createTokenStorage(fallbackFile: string): Promise<TokenStorage> {
  try {
    // Try to use keytar (secure)
    await import('keytar');
    return new KeytarTokenStorage();
  } catch {
    // Fall back to file storage
    console.warn('Keytar not available, using file-based token storage (less secure)');
    return new FileTokenStorage(fallbackFile);
  }
}
