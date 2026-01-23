import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { FileOperations } from './packages/cli/src/ui/components/file-explorer/FileOperations.js';

const testDir = path.join(os.tmpdir(), 'debug-test');
await fs.mkdir(testDir, { recursive: true });

const fileOps = new FileOperations(testDir);
const filePath = path.join(testDir, 'A');

console.log('testDir:', testDir);
console.log('filePath:', filePath);

const result = await fileOps.createFile(filePath, 'test');
console.log('result:', result);

await fs.rm(testDir, { recursive: true, force: true });
