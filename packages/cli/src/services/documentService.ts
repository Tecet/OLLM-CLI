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
 * Discovers and loads documentation files from the .dev/docs directory
 */
export class DocumentService {
  private basePath: string;

  constructor(basePath: string = '.dev/docs') {
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
          name: 'General',
          path: this.basePath,
          documents: rootDocs,
        });
      }

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
    // Convert kebab-case or snake_case to Title Case
    return folderName
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format document title from filename
   */
  private formatDocTitle(fileName: string): string {
    // Remove .md extension and format
    const nameWithoutExt = fileName.replace(/\.md$/, '');
    
    // Convert kebab-case or snake_case to Title Case
    return nameWithoutExt
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Singleton instance
export const documentService = new DocumentService();
