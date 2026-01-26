# OAuth Setup Guide

**Configuring OAuth Authentication for MCP Servers**

---

## Overview

Many MCP servers require OAuth for authentication (GitHub, Google, etc.).

---

## Configuration

### In Config File

```yaml
mcp:
  servers:
    github:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-github"]
      transport: "stdio"
      oauth:
        provider: "github"
        clientId: "${GITHUB_CLIENT_ID}"
        clientSecret: "${GITHUB_CLIENT_SECRET}"
        scopes: ["repo", "user"]
        redirectUri: "http://localhost:3000/callback"
```

### Environment Variables

```bash
# .env file
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

---

## OAuth Flow

### 1. Register Application

**GitHub:**
1. Go to Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Set redirect URI: `http://localhost:3000/callback`
4. Copy Client ID and Client Secret

**Google:**
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Set redirect URI
4. Copy credentials

### 2. Configure OLLM CLI

Add OAuth configuration to `~/.ollm/config.yaml`

### 3. Login

```bash
# Start OAuth flow
/mcp oauth login github

# Opens browser for authorization
# Returns to CLI with token
```

### 4. Verify

```bash
# Check OAuth status
/mcp oauth status

# List tokens
/mcp oauth list
```

---

## Managing Tokens

### Check Status

```bash
/mcp oauth status
```

### Revoke Token

```bash
/mcp oauth revoke github
```

### Refresh Token

Tokens are automatically refreshed when expired.

---

## Supported Providers

- GitHub
- Google
- Microsoft
- GitLab
- Bitbucket
- Custom OAuth 2.0

---

## Troubleshooting

**Token expired:**
- Tokens refresh automatically
- Or run `/mcp oauth login github` again

**Authorization failed:**
- Check client ID and secret
- Verify redirect URI matches
- Check scopes are correct

**Server not using token:**
- Restart server: `/mcp restart github`
- Check server logs

---

## Further Reading

- [MCP Servers Overview](README.md)
- [Server Development Guide](development-guide.md)
- [Health Monitoring](health-monitoring.md)
- [MCP Commands](../MCP_commands.md)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0
