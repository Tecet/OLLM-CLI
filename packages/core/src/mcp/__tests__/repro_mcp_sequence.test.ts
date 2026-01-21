import { it } from 'vitest';
import { DefaultMCPClient } from '../mcpClient.js';

it('reproduce: start all servers, stop subset, log statuses', async () => {
  const client = new DefaultMCPClient({ enabled: true });
  const allServers = ['server-1', 'server-2', 'server-3'];

  console.log('--- Starting all servers ---');
  for (const name of allServers) {
    const config = { command: 'echo', args: ['test'], env: {} };
    try {
      await client.startServer(name, config);
      console.log(`startServer(${name}) -> started`);
    } catch (err) {
      console.log(`startServer(${name}) -> failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const s = client.getServerStatus(name);
    console.log(`status after start for ${name}:`, s);
  }

  // Disable server-1
  console.log('\n--- Stopping server-1 ---');
  await client.stopServer('server-1');
  for (const name of allServers) {
    const s = client.getServerStatus(name);
    console.log(`status after stop for ${name}:`, s);
  }

  // Cleanup: stop remaining servers
  console.log('\n--- Cleanup: stopping remaining servers ---');
  for (const name of allServers) {
    try {
      await client.stopServer(name);
    } catch (_e) {
      // ignore
    }
    console.log(`final status for ${name}:`, client.getServerStatus(name));
  }
});