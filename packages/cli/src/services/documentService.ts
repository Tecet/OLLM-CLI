import fs from 'fs';
import path from 'path';

export interface DocFile {
  title: string;
  fileName: string;
  path: string;
}

export interface DocFolder {
  name: string;
  path: string;
  documents: DocFile[];
}

/**
 * Document Service
 * Discovers and loads documentation files from the docs directory
 */
export class DocumentService {
  private basePath: string;

  constructor(basePath: string = 'docs') {
    this.basePath = basePath;
  }

  /**
   * Discover all documentation files organized by folder
   */
  discoverDocuments(): DocFolder[] {
    const folders: DocFolder[] = [];

    try {
      // Check if base path exists
      if (!fs.existsSync(this.basePath)) {
        console.warn(`Documentation path not found: ${this.basePath}`);
        return folders;
      }

      // Read all entries in the base path
      const entries = fs.readdirSync(this.basePath, { withFileTypes: true });

      // Process each directory
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Skip hidden folders and special folders
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

      // Also scan root level files
      const rootDocs = this.scanFolder(this.basePath, true);
      if (rootDocs.length > 0) {
        folders.unshift({
          name: 'Getting Started',
          path: this.basePath,
          documents: rootDocs,
        });
      }

      // Sort folders in a logical order
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

        // If both are in the order list, sort by their position
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        // If only one is in the order list, it comes first
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        // Otherwise, sort alphabetically
        return a.name.localeCompare(b.name);
      });

      return folders;
    } catch (error) {
      console.error('Error discovering documents:', error);
      return folders;
    }
  }

  /**
   * Scan a folder for markdown files
   */
  private scanFolder(folderPath: string, _rootOnly: boolean = false): DocFile[] {
    const documents: DocFile[] = [];

    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        // Only process files (not subdirectories)
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(folderPath, entry.name);

          documents.push({
            title: this.formatDocTitle(entry.name),
            fileName: entry.name,
            path: filePath,
          });
        }
      }

      // Sort documents alphabetically by title
      documents.sort((a, b) => a.title.localeCompare(b.title));

      return documents;
    } catch (error) {
      console.error(`Error scanning folder ${folderPath}:`, error);
      return documents;
    }
  }

  /**
   * Load document content from file
   */
  async loadDocument(filePath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`Error loading document ${filePath}:`, error);
      return `Error loading document: ${error}`;
    }
  }

  /**
   * Format folder name for display
   */
  private formatFolderName(folderName: string): string {
    // Handle special cases
    if (folderName === 'UI&Settings') {
      return 'UI & Settings';
    }
    if (folderName === 'LLM Models') {
      return 'LLM Models';
    }
    if (folderName === 'Prompts System') {
      return 'Prompts System';
    }
    if (folderName === 'DevelopmentRoadmap') {
      return 'Development Roadmap';
    }

    // Convert kebab-case or snake_case to Title Case
    return folderName
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format document title from filename
   */
  private formatDocTitle(fileName: string): string {
    // Remove .md extension
    const nameWithoutExt = fileName.replace(/\.md$/, '');

    // Handle special cases
    const specialCases: Record<string, string> = {
      README: 'Overview',
      Index: 'Index',
      LLM_Index: 'LLM Index',
      LLM_ModelsList: 'Models List',
      LLM_MemorySystem: 'Memory System',
      LLM_ModelCompatibility: 'Model Compatibility',
      LLM_ModelsArchitecture: 'Models Architecture',
      LLM_ModelsCommands: 'Models Commands',
      LLM_ModelsConfiguration: 'Models Configuration',
      LLM_GettingStarted: 'Getting Started',
      MCP_Architecture: 'MCP Architecture',
      MCP_Commands: 'MCP Commands',
      MCP_GettingStarted: 'MCP Getting Started',
      MCP_Integration: 'MCP Integration',
      MCP_Index: 'MCP Index',
      MCP_Marketplace: 'MCP Marketplace',
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

    // Convert kebab-case, snake_case, or PascalCase to Title Case
    return nameWithoutExt
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

// Singleton instance
export const documentService = new DocumentService();
