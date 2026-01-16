# Health Monitoring Guide

**Monitoring MCP Server Health**

---

## Overview

OLLM CLI automatically monitors MCP server health and can restart failed servers.

---

## Configuration

### Enable Health Monitoring

```yaml
mcp:
  healthCheck:
    enabled: true
    interval: 30000        # Check every 30 seconds
    timeout: 5000          # 5 second timeout
    retries: 3             # Retry 3 times
    autoRestart: true      # Auto-restart on failure
```

### Per-Server Configuration

```yaml
mcp:
  servers:
    github:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-github"]
      healthCheck:
        enabled: true
        interval: 60000    # Check every minute
```

---

## Commands

### Check Health

```bash
# Check all servers
/mcp health

# Check specific server
/mcp health check github
```

### Start/Stop Monitoring

```bash
# Start monitoring
/mcp health start

# Stop monitoring
/mcp health stop

# Show status
/mcp health status
```

### Manual Restart

```bash
# Restart server
/mcp restart github

# Restart all servers
/mcp restart --all
```

---

## Health Events

### Event Types

- `server-healthy` - Server is responding
- `server-unhealthy` - Server not responding
- `server-restarted` - Server was restarted
- `server-failed` - Server failed to restart

### Event Handling

Health events can trigger hooks:

```bash
# Create hook for server failures
/hooks create on-server-failed "./notify-admin.sh"
```

---

## Troubleshooting

### Server Unhealthy

**Check logs:**
```bash
/mcp logs github
```

**Manual restart:**
```bash
/mcp restart github
```

**Check configuration:**
```bash
/mcp info github
```

### Auto-Restart Failing

**Increase retries:**
```yaml
healthCheck:
  retries: 5
```

**Increase timeout:**
```yaml
healthCheck:
  timeout: 10000
```

**Check server dependencies:**
- Verify command exists
- Check environment variables
- Verify network access

---

## Best Practices

**Do:**
- ✅ Enable health monitoring
- ✅ Set appropriate intervals
- ✅ Monitor critical servers
- ✅ Set up failure notifications

**Don't:**
- ❌ Set interval too low (< 10 seconds)
- ❌ Disable auto-restart for critical servers
- ❌ Ignore health warnings

---

## Further Reading

- [MCP Servers Overview](README.md)
- [Server Development Guide](development-guide.md)
- [OAuth Setup](oauth-setup.md)
- [MCP Commands](../MCP_commands.md)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0
