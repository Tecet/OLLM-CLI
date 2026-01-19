import http from 'node:http';
import { LocalProvider } from '../localProvider';

test('LocalProvider handles NDJSON streaming from Ollama-like server', async () => {
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });

      // write a text chunk
      res.write(JSON.stringify({ message: { content: 'Hello' } }) + '\n');

      // write a tool call chunk after a brief delay
      setTimeout(() => {
        res.write(JSON.stringify({ message: { tool_calls: [{ id: 'tool-1', function: { name: 'doThing', arguments: { foo: 'bar' } } }] } }) + '\n');
      }, 10);

      // finish chunk
      setTimeout(() => {
        res.write(JSON.stringify({ done: true, done_reason: 'stop' }) + '\n');
        res.end();
      }, 20);
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

  const baseUrl = `http://localhost:${port}`;
  const provider = new LocalProvider({ baseUrl });

  const events: string[] = [];

  const stream = provider.chatStream({
    model: 'test-model',
    messages: [{ role: 'user', parts: [{ type: 'text' as const, text: 'Ping' }] }],
    abortSignal: undefined,
    timeout: 5000,
  });

  for await (const event of stream) {
    if (event.type === 'text') events.push(`text:${event.value}`);
    if (event.type === 'tool_call') events.push(`tool:${(event.value as any).name}`);
    if (event.type === 'finish') events.push(`finish:${event.reason}`);
  }

  // Basic assertions
  expect(events).toContain('text:Hello');
  expect(events).toContain('tool:doThing');
  expect(events).toContain('finish:stop');

  server.close();
});
