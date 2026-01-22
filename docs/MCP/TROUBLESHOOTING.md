# MCP Troubleshooting Guide

**Version**: 0.1.0  
**Last Updated**: January 22, 2026

## Quick Diagnosis

Use this flowchart to quickly identify your issue:

```
Server won't start?
├─ Yes → See "Connection Issues"
└─ No
    ↓
OAuth failing?
├─ Yes → See "OAuth Issues"
└─ No
    ↓
Tools not working?
├─ Yes → See "Tool Issues"
└─ No
    ↓
Performance problems?
└─ Yes → See "Performance Issues"
```

---

## Connection Issues

### Issue: Server Stuck on "Starting"

**Symptoms**:
- Status shows "starting" for > 30 seconds
- Eventually times out with connection error
- No logs appear in server log viewer

**Common Causes**:
1. Server process fails to start
2. Missing dependencies
3. Incorrect command or arguments
4. Environment variables not set

**Diagnosis Steps**:

1. **Check Server Logs**:
   ```
   Ctrl+M → Select server → View Logs
   ```
   Look for error messages or stack traces.

2. **Test Command Manually**:
   ```bash
   # Copy command from config
   uvx mcp-server-brave-search
   ```
   Does it start successfully?

3. **Verify Dependencies**:
   ```bash
   # For Python servers
   which uvx
   which python3
   
   # For Node servers
   which node
   which npm
   ```

4. **Check Environment Variables**:
   ```bash
   echo $BRAVE_API_KEY
   echo $GITHUB_TOKEN
   ```

**Solutions**:

✅ **Install Missing Dependencies**:
```bash
# Install uv (Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Node.js
# Visit https://nodejs.org/
```

✅ **Fix Command Path**:
```json
{
  "command": "/usr/local/bin/uvx",  // Use absolute path
  "args": ["mcp-server-brave-search"]
}
```

✅ **Set Environment Variables**:
```bash
# Add to ~/.bashrc or ~/.zshrc
export BRAVE_API_KEY="your-api-key-here"
export GITHUB_TOKEN="your-token-here"
```

✅ **Increase Timeout**:
```json
{
  "timeout": 60000  // 60 seconds for slow servers
}
```

---

### Issue: Connection Timeout

**Symptoms**:
- Error: "Connection timeout after 30000ms"
- Server process starts but doesn't respond
- Logs show server is running

**Common Causes**:
1. Server takes too long to initialize
2. Server not implementing MCP protocol correctly
3. Network latency (for remote servers)
4. Server waiting for input

**Diagnosis Steps**:

1. **Check Server Initialization Time**:
   ```bash
   time uvx mcp-server-brave-search
   ```
   How long until it's ready?

2. **Test Protocol Manually**:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | uvx mcp-server-brave-search
   ```
   Does it respond?

3. **Review Server Implementation**:
   - Does it send initialize response?
   - Is it reading from stdin?
   - Is it writing to stdout?

**Solutions**:

✅ **Increase Timeout**:
```json
{
  "timeout": 60000  // Increase to 60 seconds
}
```

✅ **Fix Server Implementation**:
```python
# Server should respond to initialize
@server.call_tool()
async def initialize(params):
    return {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "serverInfo": {
            "name": "my-server",
            "version": "1.0.0"
        }
    }
```

✅ **Use HTTP Transport** (for remote servers):
```json
{
  "url": "https://api.example.com/mcp",
  "transport": "http",
  "timeout": 45000
}
```

---

### Issue: Server Crashes Immediately

**Symptoms**:
- Server starts then immediately disconnects
- Status changes: starting → error
- Logs show process exit

**Common Causes**:
1. Missing required arguments
2. Invalid configuration
3. Port already in use
4. Permission denied

**Diagnosis Steps**:

1. **Check Exit Code**:
   ```bash
   uvx mcp-server-brave-search
   echo $?  # Non-zero = error
   ```

2. **Review Server Logs**:
   Look for:
   - "Permission denied"
   - "Port already in use"
   - "Missing required argument"
   - Stack traces

3. **Test with Minimal Config**:
   ```json
   {
     "command": "uvx",
     "args": ["mcp-server-brave-search"],
     "env": {}
   }
   ```

**Solutions**:

✅ **Add Required Arguments**:
```json
{
  "args": ["mcp-server-brave-search", "--port", "3000"]
}
```

✅ **Fix Permissions**:
```bash
chmod +x /path/to/server
```

✅ **Use Different Port**:
```json
{
  "env": {
    "PORT": "3001"  // Change from default
  }
}
```

---

## OAuth Issues

### Issue: "No OAuth token available"

**Symptoms**:
- Error when enabling OAuth-required server
- Message: "Please authenticate via settings"
- Server won't start

**Common Causes**:
1. Never authenticated
2. Token expired
3. Token file deleted
4. OAuth configuration incorrect

**Diagnosis Steps**:

1. **Check Token File**:
   ```bash
   ls -la ~/.ollm/mcp/oauth-tokens.json
   cat ~/.ollm/mcp/oauth-tokens.json
   ```

2. **Verify OAuth Config**:
   ```json
   {
     "oauth": {
       "enabled": true,
       "clientId": "...",  // Is this correct?
       "scopes": ["..."]   // Are these correct?
     }
   }
   ```

3. **Test OAuth Flow**:
   - Open MCP Panel (Ctrl+M)
   - Select server
   - Press 'O' for OAuth
   - Does browser open?

**Solutions**:

✅ **Authenticate**:
```
1. Ctrl+M (Open MCP Panel)
2. Select OAuth-required server
3. Press 'O' (OAuth configuration)
4. Follow browser flow
5. Grant permissions
6. Return to CLI
```

✅ **Fix OAuth Configuration**:
```json
{
  "oauth": {
    "enabled": true,
    "clientId": "correct-client-id",
    "clientSecret": "correct-secret",  // Optional with PKCE
    "scopes": ["read", "write"],
    "usePKCE": true  // Recommended
  }
}
```

✅ **Regenerate Token**:
```bash
# Delete old token
rm ~/.ollm/mcp/oauth-tokens.json

# Re-authenticate via MCP Panel
```

---

### Issue: Browser Doesn't Open

**Symptoms**:
- OAuth flow starts but browser doesn't open
- Stuck waiting for authentication
- No error message

**Common Causes**:
1. No default browser set
2. Browser blocked by firewall
3. Headless environment (SSH, Docker)
4. Port already in use

**Diagnosis Steps**:

1. **Check Default Browser**:
   ```bash
   # macOS
   defaults read com.apple.LaunchServices/com.apple.launchservices.secure LSHandlers
   
   # Linux
   xdg-settings get default-web-browser
   
   # Windows
   # Check Settings → Default Apps → Web browser
   ```

2. **Test Port Availability**:
   ```bash
   # Check if redirect port is available
   lsof -i :3000
   netstat -an | grep 3000
   ```

3. **Check Firewall**:
   ```bash
   # macOS
   /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
   
   # Linux
   sudo ufw status
   
   # Windows
   netsh advfirewall show allprofiles
   ```

**Solutions**:

✅ **Set Default Browser**:
```bash
# macOS
open -a "Google Chrome" https://example.com

# Linux
xdg-settings set default-web-browser google-chrome.desktop

# Windows
# Settings → Default Apps → Web browser
```

✅ **Use Different Port**:
```json
{
  "oauth": {
    "redirectPort": 3001  // Change from default 3000
  }
}
```

✅ **Manual OAuth Flow** (for headless):
```bash
# 1. Get authorization URL from logs
# 2. Open URL on local machine
# 3. Copy callback URL
# 4. Paste into CLI prompt
```

---

### Issue: Token Expired

**Symptoms**:
- Server was working, now fails
- Error: "Token expired" or "Unauthorized"
- OAuth status shows expired

**Common Causes**:
1. Token lifetime exceeded
2. Refresh token invalid
3. Server revoked token
4. Clock skew

**Diagnosis Steps**:

1. **Check Token Expiration**:
   ```bash
   cat ~/.ollm/mcp/oauth-tokens.json | jq '.["server-name"].expiresAt'
   ```

2. **Verify System Time**:
   ```bash
   date
   # Should match actual time
   ```

3. **Test Token Manually**:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" https://api.example.com/test
   ```

**Solutions**:

✅ **Re-authenticate**:
```
Ctrl+M → Select server → Press 'O' → Authenticate
```

✅ **Fix System Time**:
```bash
# macOS
sudo sntp -sS time.apple.com

# Linux
sudo ntpdate pool.ntp.org

# Windows
w32tm /resync
```

✅ **Enable Auto-Refresh**:
```json
{
  "oauth": {
    "autoRefresh": true  // Refresh before expiration
  }
}
```

---

## Tool Issues

### Issue: Tools Not Appearing

**Symptoms**:
- Server connected successfully
- No tools in tool list
- LLM can't use server tools

**Common Causes**:
1. Server doesn't implement tools/list
2. Tool registration failed
3. Server returned empty tool list
4. Race condition during registration

**Diagnosis Steps**:

1. **Check Server Status**:
   ```
   Ctrl+M → Select server → View Details
   ```
   Does it show "Tools: 0"?

2. **Test tools/list Manually**:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uvx mcp-server-brave-search
   ```

3. **Review Registration Logs**:
   Look for:
   - "Registering tools for server..."
   - "Tool registration failed..."
   - "No tools returned"

**Solutions**:

✅ **Restart Server**:
```
Ctrl+M → Select server → Press 'R' (Restart)
```

✅ **Fix Server Implementation**:
```python
@server.list_tools()
async def list_tools():
    return {
        "tools": [
            {
                "name": "search_web",
                "description": "Search the web",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"}
                    },
                    "required": ["query"]
                }
            }
        ]
    }
```

✅ **Check Tool Schema**:
```json
{
  "name": "tool_name",
  "description": "Tool description",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

---

### Issue: Tool Execution Fails

**Symptoms**:
- Tool appears in list
- Execution returns error
- LLM receives error message

**Common Causes**:
1. Invalid tool arguments
2. Server-side error
3. Timeout
4. Missing permissions

**Diagnosis Steps**:

1. **Check Error Message**:
   What does the error say?
   - "Invalid arguments"
   - "Permission denied"
   - "Timeout"
   - "Internal server error"

2. **Test Tool Manually**:
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_web","arguments":{"query":"test"}}}' | uvx mcp-server-brave-search
   ```

3. **Review Server Logs**:
   ```
   Ctrl+M → Select server → View Logs
   ```

**Solutions**:

✅ **Fix Arguments**:
```typescript
// Ensure arguments match schema
{
  "query": "search term",  // Required
  "numResults": 5          // Optional
}
```

✅ **Increase Timeout**:
```json
{
  "timeout": 60000  // For slow tools
}
```

✅ **Fix Server Permissions**:
```python
# Ensure server has required permissions
import os
os.chmod('/path/to/file', 0o644)
```

---

### Issue: Tool Timeout

**Symptoms**:
- Tool starts executing
- Times out after 30-60 seconds
- Partial results returned

**Common Causes**:
1. Tool takes too long
2. Network latency
3. Server overloaded
4. Infinite loop

**Diagnosis Steps**:

1. **Measure Execution Time**:
   ```bash
   time echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"slow_tool","arguments":{}}}' | uvx mcp-server
   ```

2. **Check Server Load**:
   ```bash
   top -p $(pgrep -f mcp-server)
   ```

3. **Review Tool Implementation**:
   - Is it doing unnecessary work?
   - Can it be optimized?
   - Should it use streaming?

**Solutions**:

✅ **Increase Tool Timeout**:
```typescript
// In mcpClient.ts
const timeout = 120000;  // 2 minutes
```

✅ **Use Streaming**:
```typescript
await client.callToolStreaming(
  'server-name',
  'slow-tool',
  args,
  (chunk) => {
    console.log('Progress:', chunk);
  }
);
```

✅ **Optimize Server**:
```python
# Add caching
@lru_cache(maxsize=100)
async def expensive_operation(query):
    # ...

# Use async/await
async def tool_handler(args):
    result = await async_operation(args)
    return result
```

---

## Performance Issues

### Issue: High Memory Usage

**Symptoms**:
- Server process using > 1GB RAM
- System becomes slow
- Server crashes with OOM

**Common Causes**:
1. Log buffer too large
2. Memory leaks
3. Large tool outputs
4. Too many cached results

**Diagnosis Steps**:

1. **Monitor Memory**:
   ```bash
   # Real-time monitoring
   top -p $(pgrep -f mcp-server)
   
   # Detailed analysis
   ps aux | grep mcp-server
   ```

2. **Check Log Buffer Size**:
   ```
   Ctrl+M → Select server → View Logs
   ```
   How many lines?

3. **Profile Memory**:
   ```python
   # Add to server
   import tracemalloc
   tracemalloc.start()
   # ... run operations ...
   snapshot = tracemalloc.take_snapshot()
   top_stats = snapshot.statistics('lineno')
   for stat in top_stats[:10]:
       print(stat)
   ```

**Solutions**:

✅ **Reduce Log Buffer**:
```typescript
// In mcpClient.ts
maxLogLines: 500  // Reduce from 1000
```

✅ **Implement Streaming**:
```python
# Instead of returning large result
async def tool_handler(args):
    result = await get_large_data()
    return result  # ❌ Loads all in memory

# Use streaming
async def tool_handler(args):
    async for chunk in stream_large_data():
        yield chunk  # ✅ Streams incrementally
```

✅ **Add Memory Limits**:
```json
{
  "env": {
    "NODE_OPTIONS": "--max-old-space-size=512"  // 512MB limit
  }
}
```

---

### Issue: Slow Tool Execution

**Symptoms**:
- Tools take > 10 seconds
- UI feels sluggish
- Users complain about performance

**Common Causes**:
1. Network latency
2. Inefficient server code
3. No caching
4. Sequential operations

**Diagnosis Steps**:

1. **Profile Tool Execution**:
   ```bash
   time echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"tool","arguments":{}}}' | uvx mcp-server
   ```

2. **Check Network Latency**:
   ```bash
   ping api.example.com
   curl -w "@curl-format.txt" -o /dev/null -s https://api.example.com
   ```

3. **Analyze Server Code**:
   - Are there N+1 queries?
   - Is data fetched unnecessarily?
   - Can operations be parallelized?

**Solutions**:

✅ **Add Caching**:
```python
from functools import lru_cache

@lru_cache(maxsize=100)
async def fetch_data(query):
    # Expensive operation
    return result
```

✅ **Parallelize Operations**:
```python
# Sequential (slow)
results = []
for item in items:
    result = await fetch(item)
    results.append(result)

# Parallel (fast)
results = await asyncio.gather(*[
    fetch(item) for item in items
])
```

✅ **Use Local Server**:
```json
{
  "transport": "stdio",  // Faster than HTTP
  "command": "node",
  "args": ["./local-server.js"]
}
```

---

## Common Error Messages

### "MCP integration is disabled in configuration"

**Cause**: MCP is disabled globally  
**Solution**: Enable in config:
```json
{
  "enabled": true
}
```

### "Server 'name' is already registered"

**Cause**: Trying to start server that's already running  
**Solution**: Stop server first or use restart

### "Transport not connected"

**Cause**: Trying to use disconnected server  
**Solution**: Check server status, restart if needed

### "Tool call timeout after 30000ms"

**Cause**: Tool took too long to execute  
**Solution**: Increase timeout or optimize tool

### "OAuth authentication required"

**Cause**: Server needs OAuth but no token available  
**Solution**: Authenticate via MCP Panel (Ctrl+M → O)

### "Failed to parse JSON-RPC message"

**Cause**: Server sent invalid JSON  
**Solution**: Fix server implementation, check stdout

### "Process stdin is not writable"

**Cause**: Server process stdin closed  
**Solution**: Check server implementation, restart

### "Server exceeded output size limit"

**Cause**: Server output > 10MB  
**Solution**: Implement streaming or reduce output

---

## Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Review server logs
3. ✅ Test server manually
4. ✅ Search existing issues
5. ✅ Try with minimal configuration

### When Asking for Help

Include:
- **Server name and version**
- **Configuration** (redact secrets)
- **Error message** (full text)
- **Server logs** (last 50 lines)
- **Steps to reproduce**
- **Expected vs actual behavior**

### Where to Get Help

- **GitHub Issues**: https://github.com/your-repo/issues
- **Discord**: https://discord.gg/your-server
- **Documentation**: https://docs.example.com
- **Stack Overflow**: Tag `mcp` + `ollm-cli`

---

## Diagnostic Commands

### Check Server Status
```bash
# View all servers
ollm mcp list

# View specific server
ollm mcp status server-name

# View server logs
ollm mcp logs server-name
```

### Test Server Manually
```bash
# Test stdio server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | uvx mcp-server-name

# Test HTTP server
curl -X POST https://api.example.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Check Configuration
```bash
# View config
cat ~/.ollm/mcp/config.json

# Validate config
ollm mcp validate-config

# Test environment variables
env | grep -E 'API_KEY|TOKEN'
```

### Monitor Performance
```bash
# Monitor server process
top -p $(pgrep -f mcp-server)

# Check network
netstat -an | grep 3000

# View logs in real-time
tail -f ~/.ollm/logs/mcp.log
```

---

**Last Updated**: January 22, 2026  
**Version**: 0.1.0
