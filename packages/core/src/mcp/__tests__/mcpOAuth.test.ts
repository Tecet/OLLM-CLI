/**
 * Tests for MCPOAuthProvider UI methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPOAuthProvider, type OAuthConfig, type OAuthTokens } from '../mcpOAuth.js';

// Mock token storage
class MockTokenStorage {
  private tokens: Map<string, OAuthTokens> = new Map();

  async getTokens(serverName: string): Promise<OAuthTokens | undefined> {
    return this.tokens.get(serverName);
  }

  async storeTokens(serverName: string, tokens: OAuthTokens): Promise<void> {
    this.tokens.set(serverName, tokens);
  }

  async deleteTokens(serverName: string): Promise<void> {
    this.tokens.delete(serverName);
  }
}

describe('MCPOAuthProvider UI Methods', () => {
  let provider: MCPOAuthProvider;
  let storage: MockTokenStorage;

  beforeEach(() => {
    storage = new MockTokenStorage();
    provider = new MCPOAuthProvider(storage);
  });

  describe('getOAuthStatus', () => {
    it('should return disconnected status when no tokens', async () => {
      const status = await provider.getOAuthStatus('test-server');
      
      expect(status.connected).toBe(false);
      expect(status.expiresAt).toBeUndefined();
      expect(status.scopes).toBeUndefined();
    });

    it('should return connected status with valid tokens', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000, // 1 hour from now
        tokenType: 'Bearer',
        scope: 'read write',
      };

      await storage.storeTokens('test-server', tokens);

      const status = await provider.getOAuthStatus('test-server');
      
      expect(status.connected).toBe(true);
      expect(status.expiresAt).toBe(tokens.expiresAt);
      expect(status.scopes).toEqual(['read', 'write']);
    });

    it('should return disconnected status for expired tokens', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        expiresAt: Date.now() - 3600000, // 1 hour ago
        tokenType: 'Bearer',
      };

      await storage.storeTokens('test-server', tokens);

      const status = await provider.getOAuthStatus('test-server');
      
      expect(status.connected).toBe(false);
    });
  });

  describe('authorize', () => {
    it('should return authorization URL', async () => {
      const config: OAuthConfig = {
        enabled: true,
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'test-client-id',
        scopes: ['read', 'write'],
        redirectPort: 3000,
        usePKCE: true,
      };

      const authUrl = await provider.authorize('test-server', config);
      
      expect(authUrl).toContain('https://example.com/oauth/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback'); // URL encoded
      expect(authUrl).toContain('response_type=code');
      expect(authUrl).toContain('scope=read+write');
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
    });

    it('should not include PKCE when disabled', async () => {
      const config: OAuthConfig = {
        enabled: true,
        authorizationUrl: 'https://example.com/oauth/authorize',
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'test-client-id',
        scopes: ['read'],
        usePKCE: false,
      };

      const authUrl = await provider.authorize('test-server', config);
      
      expect(authUrl).not.toContain('code_challenge=');
      expect(authUrl).not.toContain('code_challenge_method=');
    });
  });

  describe('refreshToken', () => {
    it('should throw error when no refresh token available', async () => {
      const config: OAuthConfig = {
        enabled: true,
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'test-client-id',
      };

      await expect(provider.refreshToken('test-server', config)).rejects.toThrow(
        'No refresh token available'
      );
    });

    it('should refresh token successfully', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'read write',
        }),
      });

      const tokens: OAuthTokens = {
        accessToken: 'old-token',
        refreshToken: 'old-refresh-token',
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
      };

      await storage.storeTokens('test-server', tokens);
      // Also set in provider's memory cache
      (provider as any).tokens.set('test-server', tokens);

      const config: OAuthConfig = {
        enabled: true,
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'test-client-id',
      };

      const newTokens = await provider.refreshToken('test-server', config);
      
      expect(newTokens.accessToken).toBe('new-access-token');
      expect(newTokens.refreshToken).toBe('new-refresh-token');
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should throw error on refresh failure', async () => {
      // Mock fetch to fail
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Invalid refresh token',
      });

      const tokens: OAuthTokens = {
        accessToken: 'old-token',
        refreshToken: 'old-refresh-token',
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
      };

      await storage.storeTokens('test-server', tokens);
      (provider as any).tokens.set('test-server', tokens);

      const config: OAuthConfig = {
        enabled: true,
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'test-client-id',
      };

      await expect(provider.refreshToken('test-server', config)).rejects.toThrow(
        'Token refresh failed'
      );
    });
  });

  describe('revokeAccess', () => {
    it('should revoke tokens locally', async () => {
      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      };

      await storage.storeTokens('test-server', tokens);

      await provider.revokeAccess('test-server');

      const status = await provider.getOAuthStatus('test-server');
      expect(status.connected).toBe(false);
    });

    it('should attempt to revoke with provider when config provided', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      };

      await storage.storeTokens('test-server', tokens);
      (provider as any).tokens.set('test-server', tokens);

      const config: OAuthConfig = {
        enabled: true,
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'test-client-id',
      };

      await provider.revokeAccess('test-server', config);

      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/oauth/revoke',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const status = await provider.getOAuthStatus('test-server');
      expect(status.connected).toBe(false);
    });

    it('should clean up locally even if provider revocation fails', async () => {
      // Mock fetch to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const tokens: OAuthTokens = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      };

      await storage.storeTokens('test-server', tokens);
      (provider as any).tokens.set('test-server', tokens);

      const config: OAuthConfig = {
        enabled: true,
        tokenUrl: 'https://example.com/oauth/token',
        clientId: 'test-client-id',
      };

      // Should not throw
      await provider.revokeAccess('test-server', config);

      const status = await provider.getOAuthStatus('test-server');
      expect(status.connected).toBe(false);
    });
  });
});
