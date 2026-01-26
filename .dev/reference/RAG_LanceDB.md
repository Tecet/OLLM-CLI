The Architecture Stack
UI/State: React + Ink (renders the CLI).

Brain: Ollama (Local LLM llama3 + Embeddings nomic-embed-text).

Long-Term Memory: LanceDB (Embedded Vector DB running locally).

Language: TypeScript (Recommended for ensuring type safety with the DB schemas).

Step 1: Project Setup & Dependencies
Initialize your project and install the necessary "Server-Side" libraries.

Bash

mkdir my-cli-ai
cd my-cli-ai
npm init -y

# UI Dependencies
npm install react ink ink-text-input ink-spinner

# AI & Data Dependencies
npm install ollama lancedb vectordb apache-arrow

# Dev Tools (TypeScript is highly recommended here)
npm install --save-dev typescript @types/react @types/node ts-node
Note: vectordb is the legacy name, but strictly use lancedb if available. The official Node package is @lancedb/lancedb or vectordb depending on the version. For this guide, I will use the standard native node bindings.

Recommendation: Ensure you have the embedding model pulled in Ollama:

Bash

ollama pull nomic-embed-text
ollama pull llama3
Step 2: The Memory Manager (Backend Logic)
Create a dedicated service MemoryService.ts. This separates your heavy database logic from your React UI components. This script handles the "Context Sharding."

TypeScript

// MemoryService.ts
import * as lancedb from "@lancedb/lancedb";
import ollama from 'ollama';
import path from 'path';
import os from 'os';

// 1. Define where the DB lives (Cross-platform safe)
const DB_PATH = path.join(os.homedir(), '.my-cli-app', 'data');

export class MemoryService {
  private db: any;
  private table: any;
  private tableName = "conversation_history";

  constructor() {}

  // Initialize DB connection
  async init() {
    // Ensure directory exists
    const fs = require('fs');
    if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(DB_PATH, { recursive: true });
    }

    this.db = await lancedb.connect(DB_PATH);
    
    // Check if table exists, otherwise create it
    const tableNames = await this.db.tableNames();
    if (!tableNames.includes(this.tableName)) {
      // Create table with empty data but correct schema (implicit via first add)
      // Note: In Node LanceDB, it's often easier to just create it on the first insert
      // or explicitly define schema if using Arrow.
    } else {
      this.table = await this.db.openTable(this.tableName);
    }
  }

  // Generate Embedding using Ollama
  private async getEmbedding(text: string): Promise<number[]> {
    const response = await ollama.embeddings({
      model: 'nomic-embed-text',
      prompt: text,
    });
    return response.embedding;
  }

  // Save a new memory (User input or AI response)
  async saveMemory(role: 'user' | 'assistant', text: string) {
    const vector = await this.getEmbedding(text);
    
    const data = [{
      vector: vector,
      text: text,
      role: role,
      timestamp: Date.now()
    }];

    if (!this.table) {
      this.table = await this.db.createTable(this.tableName, data);
    } else {
      await this.table.add(data);
    }
  }

  // The "Context Sharding" Magic
  async retrieveContext(query: string, limit: number = 3): Promise<string> {
    if (!this.table) return "";

    const queryVector = await this.getEmbedding(query);
    
    // Search the vector store
    const results = await this.table.vectorSearch(queryVector)
      .limit(limit)
      .toArray();

    // Format the results for the LLM prompt
    if (results.length === 0) return "";
    
    return results
      .map((r: any) => `[Old ${r.role} message]: ${r.text}`)
      .join("\n");
  }
}

export const memoryService = new MemoryService();
Step 3: The React Ink Component (UI Layer)
Now, build your App.tsx. This component handles the active "Context Window" (React State) and calls the Memory Service to fetch older context.

TypeScript

// App.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import ollama from 'ollama';
import { memoryService } from './MemoryService';

const App = () => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{role: string, content: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready');

  // Initialize DB on mount
  useEffect(() => {
    const initDB = async () => {
      setStatus('Initializing Memory...');
      await memoryService.init();
      setStatus('Ready');
    };
    initDB();
  }, []);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    // 1. Update Local State (Active Context)
    const userMsg = { role: 'user', content: input };
    setHistory(prev => [...prev, userMsg]);
    setLoading(true);
    setStatus('Thinking & Searching Memories...');
    setInput(''); // Clear input

    try {
      // 2. RAG Step: Retrieve "Sharded" Context from Disk
      const longTermContext = await memoryService.retrieveContext(userMsg.content);

      // 3. Construct the "Hybrid" Prompt
      // We combine: System Instructions + Long Term Context + Short Term History
      const systemMessage = {
        role: 'system',
        content: `You are a helper. Use this past context if relevant:\n${longTermContext}`
      };

      // We only send the last 10 messages of active history to save VRAM
      const activeContext = history.slice(-10); 

      // 4. Call Ollama
      const response = await ollama.chat({
        model: 'llama3',
        messages: [systemMessage, ...activeContext, userMsg],
      });

      const aiContent = response.message.content;

      // 5. Update UI
      setHistory(prev => [...prev, { role: 'assistant', content: aiContent }]);

      // 6. Async Background Save (Don't block UI)
      // Save both user query and AI response to Long-Term Memory
      memoryService.saveMemory('user', userMsg.content);
      memoryService.saveMemory('assistant', aiContent);

    } catch (error) {
      setHistory(prev => [...prev, { role: 'error', content: 'Error contacting Ollama' }]);
    } finally {
      setLoading(false);
      setStatus('Ready');
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">DevMind CLI </Text>
        <Text color="gray"> | Status: {status}</Text>
      </Box>

      {/* Chat History Window */}
      <Box flexDirection="column" marginY={1}>
        {history.map((msg, idx) => (
          <Box key={idx} flexDirection="column" marginY={0}>
            <Text bold color={msg.role === 'user' ? 'green' : 'blue'}>
              {msg.role === 'user' ? 'You' : 'AI'}:
            </Text>
            <Text>{msg.content}</Text>
          </Box>
        ))}
      </Box>

      {/* Input Area */}
      <Box borderStyle="classic" borderColor="gray">
        <Box marginRight={1}>
          <Text color="green">{'>'}</Text>
        </Box>
        {loading ? (
          <Text><Spinner type="dots" /> Generating...</Text>
        ) : (
          <TextInput 
            value={input} 
            onChange={setInput} 
            onSubmit={handleSubmit} 
            placeholder="Ask about your code..."
          />
        )}
      </Box>
      
      <Text color="gray" italic>Type 'exit' to quit (ctrl+c)</Text>
    </Box>
  );
};

export default App;
Step 4: Managing the "Context Window" Logic
In the code above, notice step 3 inside handleSubmit. This is where the context management strategy lives.

Strategy: The Sliding Anchor

RAM (Active State): history state in React. This grows as you chat.

VRAM Limit Protection: history.slice(-10). We strictly send only the last 10 messages to Ollama. This prevents the context window from filling up and slowing down generation.

Context Recovery (RAG): If you ask about something from message #50 (which is no longer in the slice), memoryService.retrieveContext finds it on disk (LanceDB) and re-injects it via the systemMessage.

Step 5: Running it
To run a React Ink app, you typically need to compile the TypeScript/Babel first.

Bash

# In package.json scripts
"scripts": {
  "build": "tsc",
  "start": "node dist/cli.js"
}
Create an entry point cli.tsx:

TypeScript

// cli.tsx
import React from 'react';
import { render } from 'ink';
import App from './App';

render(<App />);
Then run:

Bash

npm run build && npm run start
Why this works well for Coders
Non-Blocking: React Ink handles the rendering loop. While Ollama is "Thinking" (waiting for await), the spinner spins, and the UI doesn't freeze.

Persistence: Since LanceDB writes to ~/.my-cli-app/data, you can close the terminal, reopen it tomorrow, ask "What did we discuss about the API structure yesterday?", and it will find the answer because it was saved to disk.

Hooks Potential: Since this is just a Node function, you can add tools easily. For example, before handleSubmit, you could scan the current folder for a package.json file and inject that into the context automatically.