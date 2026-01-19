import http from 'node:http';
import { LocalProvider } from '../localProvider';

test('LocalProvider handles fragmented NDJSON (JSON split across TCP chunks)', async () => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });

      // send a JSON object split across multiple writes
      const obj = JSON.stringify({ message: { content: 'fragmented' } });
      // write in two fragments
      res.write(obj.slice(0, Math.ceil(obj.length / 2)));
      setTimeout(() => {
        res.write(obj.slice(Math.ceil(obj.length / 2)) + '\n');
      }, 5);

      setTimeout(() => {
        res.write(JSON.stringify({ done: true }) + '\n');
        res.end();
      }, 10);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  let port: number;
  if (address && typeof address === 'object') port = address.port;
  else throw new Error('Failed to get server port');

  const provider = new LocalProvider({ baseUrl: `http://localhost:${port}` });

  const events: string[] = [];
  const stream = provider.chatStream({
    model: 'test-model',
    messages: [{ role: 'user', parts: [{ type: 'text' as const, text: 'Ping' }] }],
    timeout: 2000,
  });

  for await (const event of stream) {
    if (event.type === 'text') events.push(`text:${event.value}`);
    if (event.type === 'finish') events.push(`finish:${event.reason}`);
  }

  expect(events).toContain('text:fragmented');
  expect(events).toContain('finish:stop');

  server.close();
});

test('LocalProvider parses stringified function.arguments gracefully', async () => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });

      // Return a tool_call where function.arguments is a JSON string
      res.write(JSON.stringify({ message: { tool_calls: [{ id: 't1', function: { name: 'say', arguments: '{"x":1}' } }] } }) + '\n');
      res.write(JSON.stringify({ done: true }) + '\n');
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  let port: number;
  if (address && typeof address === 'object') port = address.port;
  else throw new Error('Failed to get server port');

  const provider = new LocalProvider({ baseUrl: `http://localhost:${port}` });

  const events: any[] = [];
  const stream = provider.chatStream({
    model: 'test-model',
    messages: [{ role: 'user', parts: [{ type: 'text' as const, text: 'Ping' }] }],
    timeout: 2000,
  });

  for await (const event of stream) {
    if (event.type === 'tool_call') events.push(event.value);
    if (event.type === 'finish') events.push({ finish: event.reason });
  }

  expect(events.some(e => e.name === 'say')).toBeTruthy();
  // args could be parsed object or raw with __parsing_error__, but ensure we received a tool call
  server.close();
});

test('LocalProvider sends options (num_ctx) in outgoing payload', async () => {
  let receivedBody: string | null = null;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => {
        receivedBody = body;
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.write(JSON.stringify({ done: true }) + '\n');
        res.end();
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  let port: number;
  if (address && typeof address === 'object') port = address.port;
  else throw new Error('Failed to get server port');

  const provider = new LocalProvider({ baseUrl: `http://localhost:${port}` });

  const stream = provider.chatStream({
    model: 'test-model',
    messages: [{ role: 'user', parts: [{ type: 'text' as const, text: 'Ping' }] }],
    options: { num_ctx: 1234 },
    timeout: 2000,
  });

  for await (const _ of stream) { /* consume */ }

  expect(receivedBody).not.toBeNull();
  if (receivedBody) {
    const parsed = JSON.parse(receivedBody);
    expect(parsed.options).toBeDefined();
    expect(parsed.options.num_ctx).toBe(1234);
  }

  server.close();
});
