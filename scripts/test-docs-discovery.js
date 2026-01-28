#!/usr/bin/env node

/**
 * Test script to verify documentation discovery
 * Run with: node scripts/test-docs-discovery.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple DocumentService implementation for testing
class DocumentService {
  constructor(basePath = 'docs') {
    this.basePath = basePath;
  }

  discoverDocuments() {
    const folders = [];

    try {
      if (!fs.existsSync(this.basePath)) {
        console.warn(`Documentation path not found: ${this.basePath}`);
        return folders;
      }

      const entries = fs.readdirSync(this.basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (entry.name.startsWith('.')) {
            continue;
          }

          const folderPath = path.join(this.basePath, entry.name);
          const documents = this.scanFolder(folderPath);

          if (documents.length > 0) {
            folders.push({
              name: this.formatFolderName(entry.name),
              path: folderPath,
              documents,
            });
          }
        }
      }

      const rootDocs = this.scanFolder(this.basePath, true);
      if (rootDocs.length > 0) {
        folders.unshift({
          name: 'Getting Started',
          path: this.basePath,
          documents: rootDocs,
        });
      }

      const folderOrder = [
        'Getting Started',
        'Context',
        'Hooks',
        'LLM Models',
        'MCP',
        'Prompts System',
        'Tools',
        'UI & Settings',
        'Development Roadmap',
      ];

      folders.sort((a, b) => {
        const indexA = folderOrder.indexOf(a.name);
        const indexB = folderOrder.indexOf(b.name);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        return a.name.localeCompare(b.name);
      });

      return folders;
    } catch (error) {
      console.error('Error discovering documents:', error);
      return folders;
    }
  }

  scanFolder(folderPath, _rootOnly = false) {
    const documents = [];

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(folderPath, entry.name);

          documents.push({
            title: this.formatDocTitle(entry.name),
            fileName: entry.name,
            path: filePath,
          });
        }
      }

      documents.sort((a, b) => a.title.localeCompare(b.title));

      return documents;
    } catch (error) {
      console.error(`Error scanning folder ${folderPath}:`, error);
      return documents;
    }
  }

  formatFolderName(folderName) {
    if (folderName === 'UI&Settings') return 'UI & Settings';
    if (folderName === 'LLM Models') return 'LLM Models';
    if (folderName === 'Prompts System') return 'Prompts System';
    if (folderName === 'DevelopmentRoadmap') return 'Development Roadmap';

    return folderName
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatDocTitle(fileName) {
    const nameWithoutExt = fileName.replace(/\.md$/, '');

    const specialCases = {
      README: 'Overview',
      Index: 'Index',
      LLM_Index: 'LLM Index',
      LLM_ModelsList: 'Models List',
      LLM_MemorySystem: 'Memory System',
      UIGuide: 'UI Guide',
      ColorASCII: 'Color ASCII',
      Keybinds: 'Keyboard Shortcuts',
      ContextArchitecture: 'Context Architecture',
      ContextCompression: 'Context Compression',
      ContextManagment: 'Context Management',
      CheckpointFlowDiagram: 'Checkpoint Flow',
      PromptsRouting: 'Prompts Routing',
      PromptsTemplates: 'Prompts Templates',
      SystemPrompts: 'System Prompts',
      RoadmapVisual: 'Visual Roadmap',
      PlanedFeatures: 'Planned Features',
    };

    if (specialCases[nameWithoutExt]) {
      return specialCases[nameWithoutExt];
    }

    return nameWithoutExt
      .replace(/([A-Z])/g, ' $1')
      .replace(/[-_]/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

// Run the test
console.log('🔍 Testing Documentation Discovery\n');
console.log('='.repeat(60));

const docService = new DocumentService();
const folders = docService.discoverDocuments();

console.log(`\n✅ Found ${folders.length} documentation sections:\n`);

folders.forEach((folder, idx) => {
  console.log(`${idx + 1}. 📁 ${folder.name} (${folder.documents.length} documents)`);
  folder.documents.forEach((doc, docIdx) => {
    console.log(`   ${docIdx + 1}. 📄 ${doc.title}`);
  });
  console.log('');
});

const totalDocs = folders.reduce((sum, folder) => sum + folder.documents.length, 0);
console.log('='.repeat(60));
console.log(`\n📊 Total: ${folders.length} sections, ${totalDocs} documents\n`);
