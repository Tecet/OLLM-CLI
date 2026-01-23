/**
 * MCP Transport Implementation
 * 
 * This module provides transport implementations for communicating with MCP servers.
 * Supports stdio, SSE (Server-Sent Events), and HTTP transports.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { MCPTransport, MCPRequest, MCPResponse } from './types.js';

/**
 * Base class for MCP transports
 * 
 * Provides common functionality for all transport implementations.
 */
export abstract class BaseMCPTransport implements MCPTransport {
  protected connected: boolean = false;

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendRequest(request: MCPRequest, timeout?: number): Promise<MCPResponse>;

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Stdio transport for MCP communication
 * 
 * Communicates with MCP servers via stdin/stdout.
 * This is the primary transport for local MCP servers.
 */
export class StdioTransport extends BaseMCPTransport {
  private process?: ChildProcess;
  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (response: MCPResponse) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private buffer: string = '';
  private outputSize: number = 0;
  private readonly MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB

  constructor(
    private command: string,
    private args: string[],
    private env?: Record<string, string>
  ) {
    super();
  }

  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Transport already connected');
    }

    return new Promise((resolve, reject) => {
      try {
        // Decide whether to use a shell for spawning.
        // On Windows some commands (like `echo`) are shell built-ins and
        // will fail with ENOENT when spawned directly. Use shell mode
        // for known built-ins to make tests and simple commands portable.
        const isWindows = process.platform === 'win32';
        const isShellBuiltin = (cmd: string) => {
          if (!cmd) return false;
          const name = cmd.split(/[\\/\\\\]/).pop()?.toLowerCase() || '';
          const builtins = ['echo', 'dir', 'type', 'cls', 'copy', 'del', 'move', 'cd', 'set'];
          return builtins.includes(name);
        };

        const spawnOptions = {
          stdio: ['pipe', 'pipe', 'pipe'] as any,
          env: {
            ...process.env,
            ...this.env,
          },
        };

        if (isWindows && isShellBuiltin(this.command)) {
          const cmdStr = [this.command, ...(this.args || [])].join(' ');
          this.process = spawn(cmdStr, { ...spawnOptions, shell: true });
        } else {
          // Spawn the MCP server process normally
          this.process = spawn(this.command, this.args, spawnOptions as any);
        }

        let errorOccurred = false;
        
        // Set timeout for readiness check
        const readinessTimeout = setTimeout(() => {
          if (!this.connected) {
            reject(new Error(`MCP Server '${this.command}' failed to become ready within timeout`));
          }
        }, 10000); // 10 second timeout for readiness

        // Set up readiness check - wait for first successful response
        const checkReadiness = () => {
          // Send a simple initialize request to verify server is ready
          const initRequest: MCPRequest = {
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: {
                name: 'ollm-cli',
                version: '0.1.0',
              },
            },
          };

          // Try to send initialize request
            this.sendRequest(initRequest, 5000)
              .then(() => {
                clearTimeout(readinessTimeout);
                this.connected = true;
                resolve();
              })
              .catch((error) => {
                // If initialize fails, still mark as connected but log warning
                // Some MCP servers may not support initialize. Suppress noisy
                // warnings during unit tests to avoid polluting test output.
                if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
                  console.warn(`MCP Server '${this.command}' initialize failed, assuming ready:`, error.message);
                }
                clearTimeout(readinessTimeout);
                this.connected = true;
                resolve();
              });
        };

        // Handle process errors
        this.process.on('error', (error: Error) => {
          const errorMessage = error.message || String(error);
          console.error(`MCP Server '${this.command}' process error: ${errorMessage}`);
          this.connected = false;
          errorOccurred = true;
          clearTimeout(readinessTimeout);
          reject(error);
        });

        // Handle stdout data (responses from server)
        this.process.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          this.outputSize += chunk.length;
          
          if (this.outputSize > this.MAX_OUTPUT_SIZE) {
            const sizeMB = (this.MAX_OUTPUT_SIZE / (1024 * 1024)).toFixed(1);
            const currentSizeMB = (this.outputSize / (1024 * 1024)).toFixed(1);
            const errorMsg = `MCP Server '${this.command}' exceeded output size limit: ${currentSizeMB}MB > ${sizeMB}MB. Consider implementing streaming or reducing output size.`;
            
            console.error(errorMsg);
            this.connected = false;
            
            // Kill the process gracefully first, then force if needed
            if (this.process) {
              this.process.kill('SIGTERM');
              setTimeout(() => {
                if (this.process && !this.process.killed) {
                  this.process.kill('SIGKILL');
                }
              }, 1000);
            }
            
            // Reject all pending requests with detailed error
            for (const [, { reject }] of this.pendingRequests) {
              reject(new Error(errorMsg));
            }
            this.pendingRequests.clear();
            return;
          }
          
          this.handleData(data);
        });

        // Handle stderr (log errors but don't fail)
        this.process.stderr?.on('data', (data: Buffer) => {
          const stderrOutput = data.toString().trim();
          console.error(`MCP Server '${this.command}' stderr: ${stderrOutput}`);
        });

        // Handle process exit
        this.process.on('exit', (code: number | null, signal: string | null) => {
          // Avoid noisy stdout during unit tests; only log in non-test environments.
          if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            console.log(`MCP Server exited with code ${code}, signal ${signal}`);
          }
          this.connected = false;

          // Reject all pending requests
          for (const [, { reject }] of this.pendingRequests) {
            reject(new Error('Server process exited'));
          }
          this.pendingRequests.clear();
        });

        // Wait a bit for process to start, then check readiness
        setTimeout(() => {
          if (!errorOccurred) {
            // Don't mark `connected` until we've confirmed the server
            // responds to an initialize request. Call readiness check
            // which will attempt to write to stdin only if the stdio
            // streams are available.
            checkReadiness();
          }
        }, 100);

      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.process) {
      return;
    }

    return new Promise((resolve) => {
      const proc = this.process;
      if (!proc) {
        resolve();
        return;
      }

      // Reject all pending requests before disconnecting
      for (const [, { reject }] of this.pendingRequests) {
        reject(new Error('Transport disconnected'));
      }
      this.pendingRequests.clear();

      // Set up exit handler
      proc.once('exit', () => {
        this.connected = false;
        this.process = undefined;
        resolve();
      });

      // Try graceful shutdown first
      proc.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (proc && !proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  async sendRequest(request: MCPRequest, timeout: number = 30000): Promise<MCPResponse> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout after ${timeout}ms for method '${request.method}'`));
        }
      }, timeout);

      // Store the promise handlers with cleanup
      this.pendingRequests.set(id, {
        resolve: (response: MCPResponse) => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(id);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(id);
          reject(error);
        },
      });

      // Create JSON-RPC request
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method: request.method,
        params: request.params,
      };

      // Send request to server
      const requestStr = JSON.stringify(jsonRpcRequest) + '\n';
      
        try {
          if (!this.process || !this.process.stdin) {
            clearTimeout(timeoutId);
            this.pendingRequests.delete(id);
            reject(new Error('Process stdin is not available'));
            return;
          }

          // Ensure stdin is writable before attempting to write
          const stdin: any = this.process.stdin;
          if (typeof stdin.writable === 'boolean' && !stdin.writable) {
            clearTimeout(timeoutId);
            this.pendingRequests.delete(id);
            reject(new Error('Process stdin is not writable'));
            return;
          }

          this.process.stdin.write(requestStr, (error) => {
            if (error) {
              clearTimeout(timeoutId);
              this.pendingRequests.delete(id);
              reject(error);
            }
          });
        } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Handle incoming data from the server
   * @param data - Raw data buffer
   */
  private handleData(data: Buffer): void {
    // Append to buffer
    this.buffer += data.toString();

    // Process complete lines
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line) {
        this.handleMessage(line);
      }
    }
  }

  /**
   * Handle a complete JSON-RPC message
   * @param message - JSON string
   */
  private handleMessage(message: string): void {
    try {
      const jsonRpcResponse = JSON.parse(message);

      // Extract the request ID
      const id = jsonRpcResponse.id;
      if (typeof id !== 'number') {
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          console.error(`MCP Server '${this.command}' received message without valid ID:`, message);
        }
        return;
      }

      // Find the pending request
      const pending = this.pendingRequests.get(id);
      if (!pending) {
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          console.error(`MCP Server '${this.command}' received response for unknown request ID:`, id);
        }
        return;
      }

      // Remove from pending
      this.pendingRequests.delete(id);

      // Convert JSON-RPC response to MCPResponse
      const response: MCPResponse = {
        result: jsonRpcResponse.result,
        error: jsonRpcResponse.error ? {
          code: jsonRpcResponse.error.code || -1,
          message: jsonRpcResponse.error.message || 'Unknown error',
          data: jsonRpcResponse.error.data,
        } : undefined,
      };

      // Resolve the promise
      pending.resolve(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Parsing errors are noisy when tests spawn simple commands (like `echo`).
      // Only log as an error in non-test environments; in tests prefer silence.
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        console.error(`MCP Server '${this.command}' failed to parse JSON-RPC message: ${errorMessage}`, message);
      }
    }
  }
}

/**
 * SSE (Server-Sent Events) transport for MCP communication
 * 
 * Communicates with MCP servers via HTTP SSE.
 * Supports bidirectional communication using SSE for server-to-client
 * and HTTP POST for client-to-server messages.
 */
export class SSETransport extends BaseMCPTransport {
  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (response: MCPResponse) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private eventSource?: EventEmitter;
  private abortController?: AbortController;
  private buffer: string = '';
  private accessToken?: string;

  constructor(private url: string, accessToken?: string) {
    super();
    this.accessToken = accessToken;
  }

  /**
   * Set the OAuth access token for authenticated requests
   * @param token - OAuth access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Transport already connected');
    }

    return new Promise((resolve, reject) => {
      try {
        this.abortController = new AbortController();
        
        const headers: Record<string, string> = {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        };

        // Add OAuth token if available
        if (this.accessToken) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        
        // Create SSE connection
        fetch(this.url, {
          method: 'GET',
          headers,
          signal: this.abortController.signal,
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
            }

            if (!response.body) {
              throw new Error('SSE response has no body');
            }

            this.connected = true;
            resolve();

            // Process the SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
              while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                  this.connected = false;
                  // Reject all pending requests
                  for (const [, { reject }] of this.pendingRequests) {
                    reject(new Error('SSE connection closed'));
                  }
                  this.pendingRequests.clear();
                  break;
                }

                const chunk = decoder.decode(value, { stream: true });
                this.handleSSEData(chunk);
              }
            } catch (error) {
              if (error instanceof Error && error.name !== 'AbortError') {
                console.error('SSE stream error:', error);
              }
              this.connected = false;
            }
          })
          .catch((error) => {
            if (error instanceof Error && error.name !== 'AbortError') {
              console.error('SSE connection error:', error);
              reject(error);
            }
          });
      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // Reject all pending requests before disconnecting
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();

    // Abort the SSE connection
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }

    this.connected = false;
    this.eventSource = undefined;
  }

  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      // Store the promise handlers
      this.pendingRequests.set(id, { resolve, reject });

      // Create JSON-RPC request
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method: request.method,
        params: request.params,
      };

      // Send request via HTTP POST
      const postUrl = this.url.replace(/\/sse$/, '/message');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add OAuth token if available
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      
      fetch(postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(jsonRpcRequest),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
          }
          // Response will come via SSE, not HTTP response
        })
        .catch((error) => {
          this.pendingRequests.delete(id);
          reject(error);
        });
    });
  }

  /**
   * Handle incoming SSE data
   * @param data - Raw SSE data string
   */
  private handleSSEData(data: string): void {
    // Append to buffer
    this.buffer += data;

    // Process complete SSE events (separated by double newlines)
    let eventEnd: number;
    while ((eventEnd = this.buffer.indexOf('\n\n')) !== -1) {
      const event = this.buffer.slice(0, eventEnd);
      this.buffer = this.buffer.slice(eventEnd + 2);

      if (event.trim()) {
        this.handleSSEEvent(event);
      }
    }
  }

  /**
   * Handle a complete SSE event
   * @param event - SSE event string
   */
  private handleSSEEvent(event: string): void {
    // Parse SSE event format
    // Example:
    // event: message
    // data: {"jsonrpc":"2.0","id":1,"result":{...}}
    
    const lines = event.split('\n');
    let eventType = 'message';
    let eventData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        eventData += line.slice(5).trim();
      }
    }

    if (eventType === 'message' && eventData) {
      this.handleMessage(eventData);
    }
  }

  /**
   * Handle a complete JSON-RPC message
   * @param message - JSON string
   */
  private handleMessage(message: string): void {
    try {
      const jsonRpcResponse = JSON.parse(message);

      // Extract the request ID
      const id = jsonRpcResponse.id;
      if (typeof id !== 'number') {
        console.error('SSE received message without valid ID:', message);
        return;
      }

      // Find the pending request
      const pending = this.pendingRequests.get(id);
      if (!pending) {
        console.error('SSE received response for unknown request ID:', id);
        return;
      }

      // Remove from pending
      this.pendingRequests.delete(id);

      // Convert JSON-RPC response to MCPResponse
      const response: MCPResponse = {
        result: jsonRpcResponse.result,
        error: jsonRpcResponse.error ? {
          code: jsonRpcResponse.error.code || -1,
          message: jsonRpcResponse.error.message || 'Unknown error',
          data: jsonRpcResponse.error.data,
        } : undefined,
      };

      // Resolve the promise
      pending.resolve(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('SSE failed to parse JSON-RPC message:', errorMessage, message);
    }
  }
}

/**
 * HTTP transport for MCP communication
 * 
 * Communicates with MCP servers via HTTP requests.
 * Uses standard HTTP POST for request/response communication.
 */
export class HTTPTransport extends BaseMCPTransport {
  private requestId: number = 0;
  private accessToken?: string;

  constructor(private url: string, accessToken?: string) {
    super();
    this.accessToken = accessToken;
  }

  /**
   * Set the OAuth access token for authenticated requests
   * @param token - OAuth access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Transport already connected');
    }

    // For HTTP transport, we just verify the server is reachable
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add OAuth token if available
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 0,
          method: 'ping',
          params: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP connection failed: ${response.status} ${response.statusText}`);
      }

      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to HTTP MCP server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.connected = false;
  }

  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    const id = ++this.requestId;

    // Create JSON-RPC request
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method: request.method,
      params: request.params,
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add OAuth token if available
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      // Create abort controller for timeout
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(this.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(jsonRpcRequest),
          signal: abortController.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
        }

        const jsonRpcResponse = await response.json();

        // Validate response ID matches request ID
        if (jsonRpcResponse.id !== id) {
          throw new Error(`Response ID mismatch: expected ${id}, got ${jsonRpcResponse.id}`);
        }

        // Convert JSON-RPC response to MCPResponse
        const mcpResponse: MCPResponse = {
          result: jsonRpcResponse.result,
          error: jsonRpcResponse.error ? {
            code: jsonRpcResponse.error.code || -1,
            message: jsonRpcResponse.error.message || 'Unknown error',
            data: jsonRpcResponse.error.data,
          } : undefined,
        };

        return mcpResponse;
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('HTTP request timeout after 30000ms');
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`HTTP request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
