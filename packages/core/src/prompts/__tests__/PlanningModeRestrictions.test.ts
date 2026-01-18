/**
 * Tests for Planning Mode File and Directory Restrictions
 */

import { describe, it, expect } from 'vitest';
import {
  isFileExtensionAllowed,
  isDirectoryAllowed,
  isFileAllowedInPlanningMode,
  getRestrictionErrorMessage,
  ALLOWED_FILE_EXTENSIONS,
  DENIED_FILE_EXTENSIONS,
  ALLOWED_DIRECTORY_PATTERNS,
  DENIED_DIRECTORY_PATTERNS
} from '../PlanningModeRestrictions.js';

describe('PlanningModeRestrictions', () => {
  describe('File Extension Validation', () => {
    describe('Allowed Extensions', () => {
      it('should allow documentation files', () => {
        expect(isFileExtensionAllowed('README.md')).toBe(true);
        expect(isFileExtensionAllowed('notes.txt')).toBe(true);
        expect(isFileExtensionAllowed('decision.adr')).toBe(true);
        expect(isFileExtensionAllowed('guide.adoc')).toBe(true);
        expect(isFileExtensionAllowed('manual.rst')).toBe(true);
      });

      it('should allow diagram files', () => {
        expect(isFileExtensionAllowed('architecture.mermaid')).toBe(true);
        expect(isFileExtensionAllowed('sequence.plantuml')).toBe(true);
        expect(isFileExtensionAllowed('diagram.drawio')).toBe(true);
        expect(isFileExtensionAllowed('sketch.excalidraw')).toBe(true);
        expect(isFileExtensionAllowed('flow.puml')).toBe(true);
        expect(isFileExtensionAllowed('graph.dot')).toBe(true);
      });

      it('should allow design document files', () => {
        expect(isFileExtensionAllowed('api.spec')).toBe(true);
        expect(isFileExtensionAllowed('system.design')).toBe(true);
        expect(isFileExtensionAllowed('feature.requirements')).toBe(true);
        expect(isFileExtensionAllowed('system.architecture')).toBe(true);
      });

      it('should be case-insensitive', () => {
        expect(isFileExtensionAllowed('README.MD')).toBe(true);
        expect(isFileExtensionAllowed('notes.TXT')).toBe(true);
        expect(isFileExtensionAllowed('diagram.MERMAID')).toBe(true);
      });
    });

    describe('Denied Extensions', () => {
      it('should deny TypeScript/JavaScript files', () => {
        expect(isFileExtensionAllowed('index.ts')).toBe(false);
        expect(isFileExtensionAllowed('component.tsx')).toBe(false);
        expect(isFileExtensionAllowed('script.js')).toBe(false);
        expect(isFileExtensionAllowed('app.jsx')).toBe(false);
        expect(isFileExtensionAllowed('module.mjs')).toBe(false);
        expect(isFileExtensionAllowed('config.cjs')).toBe(false);
      });

      it('should deny other programming language files', () => {
        expect(isFileExtensionAllowed('main.py')).toBe(false);
        expect(isFileExtensionAllowed('app.rb')).toBe(false);
        expect(isFileExtensionAllowed('Main.java')).toBe(false);
        expect(isFileExtensionAllowed('program.c')).toBe(false);
        expect(isFileExtensionAllowed('lib.cpp')).toBe(false);
        expect(isFileExtensionAllowed('main.go')).toBe(false);
        expect(isFileExtensionAllowed('lib.rs')).toBe(false);
      });

      it('should deny configuration files', () => {
        expect(isFileExtensionAllowed('package.json')).toBe(false);
        expect(isFileExtensionAllowed('config.yaml')).toBe(false);
        expect(isFileExtensionAllowed('settings.yml')).toBe(false);
        expect(isFileExtensionAllowed('app.toml')).toBe(false);
        expect(isFileExtensionAllowed('config.ini')).toBe(false);
        expect(isFileExtensionAllowed('.env')).toBe(false);
      });

      it('should deny database files', () => {
        expect(isFileExtensionAllowed('schema.sql')).toBe(false);
        expect(isFileExtensionAllowed('schema.prisma')).toBe(false);
        expect(isFileExtensionAllowed('query.graphql')).toBe(false);
        expect(isFileExtensionAllowed('api.gql')).toBe(false);
      });

      it('should deny script files', () => {
        expect(isFileExtensionAllowed('build.sh')).toBe(false);
        expect(isFileExtensionAllowed('setup.bash')).toBe(false);
        expect(isFileExtensionAllowed('deploy.ps1')).toBe(false);
        expect(isFileExtensionAllowed('run.bat')).toBe(false);
        expect(isFileExtensionAllowed('start.cmd')).toBe(false);
      });

      it('should deny lock files', () => {
        expect(isFileExtensionAllowed('package-lock.json')).toBe(false);
        expect(isFileExtensionAllowed('yarn.lock')).toBe(false);
        expect(isFileExtensionAllowed('pnpm-lock.yaml')).toBe(false);
      });
    });

    describe('Unknown Extensions', () => {
      it('should deny unknown extensions by default', () => {
        expect(isFileExtensionAllowed('file.xyz')).toBe(false);
        expect(isFileExtensionAllowed('data.unknown')).toBe(false);
        expect(isFileExtensionAllowed('test.foo')).toBe(false);
      });
    });
  });

  describe('Directory Validation', () => {
    describe('Allowed Directories', () => {
      it('should allow documentation directories', () => {
        expect(isDirectoryAllowed('docs/README.md')).toBe(true);
        expect(isDirectoryAllowed('docs/api/endpoints.md')).toBe(true);
        expect(isDirectoryAllowed('.docs/internal.md')).toBe(true);
        expect(isDirectoryAllowed('documentation/guide.md')).toBe(true);
        expect(isDirectoryAllowed('doc/notes.txt')).toBe(true);
      });

      it('should allow design directories', () => {
        expect(isDirectoryAllowed('design/architecture.md')).toBe(true);
        expect(isDirectoryAllowed('designs/system.spec')).toBe(true);
        expect(isDirectoryAllowed('specs/feature.md')).toBe(true);
        expect(isDirectoryAllowed('.specs/internal.spec')).toBe(true);
        expect(isDirectoryAllowed('specifications/api.md')).toBe(true);
      });

      it('should allow ADR directories', () => {
        expect(isDirectoryAllowed('adr/001-decision.md')).toBe(true);
        expect(isDirectoryAllowed('.adr/002-choice.adr')).toBe(true);
        expect(isDirectoryAllowed('adrs/003-architecture.md')).toBe(true);
      });

      it('should allow planning directories', () => {
        expect(isDirectoryAllowed('planning/roadmap.md')).toBe(true);
        expect(isDirectoryAllowed('plans/sprint.md')).toBe(true);
      });

      it('should allow Kiro-specific directories', () => {
        expect(isDirectoryAllowed('.kiro/specs/feature/design.md')).toBe(true);
        expect(isDirectoryAllowed('.kiro/plan_draft/notes.txt')).toBe(true);
      });

      it('should handle nested paths correctly', () => {
        expect(isDirectoryAllowed('docs/api/v1/endpoints.md')).toBe(true);
        expect(isDirectoryAllowed('design/system/architecture/overview.md')).toBe(true);
      });

      it('should be case-insensitive', () => {
        expect(isDirectoryAllowed('DOCS/README.MD')).toBe(true);
        expect(isDirectoryAllowed('Design/Architecture.md')).toBe(true);
      });

      it('should handle backslashes (Windows paths)', () => {
        expect(isDirectoryAllowed('docs\\README.md')).toBe(true);
        expect(isDirectoryAllowed('design\\system.spec')).toBe(true);
      });

      it('should handle leading ./ paths', () => {
        expect(isDirectoryAllowed('./docs/README.md')).toBe(true);
        expect(isDirectoryAllowed('./design/spec.md')).toBe(true);
      });
    });

    describe('Denied Directories', () => {
      it('should deny source code directories', () => {
        expect(isDirectoryAllowed('src/index.ts')).toBe(false);
        expect(isDirectoryAllowed('lib/utils.js')).toBe(false);
        expect(isDirectoryAllowed('packages/core/index.ts')).toBe(false);
        expect(isDirectoryAllowed('app/main.py')).toBe(false);
        expect(isDirectoryAllowed('components/Button.tsx')).toBe(false);
      });

      it('should deny build directories', () => {
        expect(isDirectoryAllowed('dist/bundle.js')).toBe(false);
        expect(isDirectoryAllowed('build/output.js')).toBe(false);
        expect(isDirectoryAllowed('out/compiled.js')).toBe(false);
        expect(isDirectoryAllowed('target/release.jar')).toBe(false);
      });

      it('should deny dependency directories', () => {
        expect(isDirectoryAllowed('node_modules/package/index.js')).toBe(false);
        expect(isDirectoryAllowed('vendor/lib/file.rb')).toBe(false);
      });

      it('should deny configuration directories', () => {
        expect(isDirectoryAllowed('config/database.json')).toBe(false);
        expect(isDirectoryAllowed('.config/settings.yaml')).toBe(false);
      });

      it('should deny database directories', () => {
        expect(isDirectoryAllowed('migrations/001_create_users.sql')).toBe(false);
        expect(isDirectoryAllowed('seeds/data.sql')).toBe(false);
        expect(isDirectoryAllowed('prisma/schema.prisma')).toBe(false);
      });

      it('should deny script directories', () => {
        expect(isDirectoryAllowed('scripts/build.sh')).toBe(false);
        expect(isDirectoryAllowed('bin/deploy.sh')).toBe(false);
      });

      it('should deny test directories', () => {
        expect(isDirectoryAllowed('test/unit.test.ts')).toBe(false);
        expect(isDirectoryAllowed('tests/integration.test.js')).toBe(false);
        expect(isDirectoryAllowed('__tests__/component.test.tsx')).toBe(false);
      });
    });

    describe('Edge Cases', () => {
      it('should handle paths with multiple directory separators', () => {
        expect(isDirectoryAllowed('docs//README.md')).toBe(true);
        expect(isDirectoryAllowed('src//index.ts')).toBe(false);
      });

      it('should handle root-level files', () => {
        // Root-level files don't match any directory pattern
        expect(isDirectoryAllowed('README.md')).toBe(false);
        expect(isDirectoryAllowed('index.ts')).toBe(false);
      });
    });
  });

  describe('Combined File and Directory Validation', () => {
    it('should allow documentation files in documentation directories', () => {
      expect(isFileAllowedInPlanningMode('docs/README.md')).toBe(true);
      expect(isFileAllowedInPlanningMode('design/architecture.spec')).toBe(true);
      expect(isFileAllowedInPlanningMode('.kiro/specs/feature/design.md')).toBe(true);
    });

    it('should deny code files even in documentation directories', () => {
      expect(isFileAllowedInPlanningMode('docs/example.ts')).toBe(false);
      expect(isFileAllowedInPlanningMode('design/script.js')).toBe(false);
    });

    it('should deny documentation files in code directories', () => {
      expect(isFileAllowedInPlanningMode('src/README.md')).toBe(false);
      expect(isFileAllowedInPlanningMode('lib/NOTES.txt')).toBe(false);
    });

    it('should deny code files in code directories', () => {
      expect(isFileAllowedInPlanningMode('src/index.ts')).toBe(false);
      expect(isFileAllowedInPlanningMode('lib/utils.js')).toBe(false);
      expect(isFileAllowedInPlanningMode('packages/core/main.ts')).toBe(false);
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error for denied file extensions', () => {
      const message = getRestrictionErrorMessage('src/index.ts');
      expect(message).toContain('Planning mode cannot write to source code files');
      expect(message).toContain('.ts');
      expect(message).toContain('Switch to Developer mode');
    });

    it('should provide helpful error for denied directories', () => {
      const message = getRestrictionErrorMessage('src/README.md');
      expect(message).toContain('Planning mode cannot write to');
      expect(message).toContain('src');
      expect(message).toContain('Switch to Developer mode');
    });

    it('should provide helpful error for unknown extensions', () => {
      const message = getRestrictionErrorMessage('docs/file.xyz');
      expect(message).toContain('Planning mode cannot write to .xyz files');
      expect(message).toContain('Allowed file types:');
      expect(message).toContain('Switch to Developer mode');
    });

    it('should mention allowed file types in error messages', () => {
      const message = getRestrictionErrorMessage('docs/file.unknown');
      expect(message).toContain('.md');
      expect(message).toContain('.txt');
    });
  });

  describe('Constants', () => {
    it('should export allowed file extensions', () => {
      expect(ALLOWED_FILE_EXTENSIONS).toBeDefined();
      expect(ALLOWED_FILE_EXTENSIONS.length).toBeGreaterThan(0);
      expect(ALLOWED_FILE_EXTENSIONS).toContain('.md');
      expect(ALLOWED_FILE_EXTENSIONS).toContain('.txt');
    });

    it('should export denied file extensions', () => {
      expect(DENIED_FILE_EXTENSIONS).toBeDefined();
      expect(DENIED_FILE_EXTENSIONS.length).toBeGreaterThan(0);
      expect(DENIED_FILE_EXTENSIONS).toContain('.ts');
      expect(DENIED_FILE_EXTENSIONS).toContain('.js');
    });

    it('should export allowed directory patterns', () => {
      expect(ALLOWED_DIRECTORY_PATTERNS).toBeDefined();
      expect(ALLOWED_DIRECTORY_PATTERNS.length).toBeGreaterThan(0);
      expect(ALLOWED_DIRECTORY_PATTERNS).toContain('docs/**');
      expect(ALLOWED_DIRECTORY_PATTERNS).toContain('design/**');
    });

    it('should export denied directory patterns', () => {
      expect(DENIED_DIRECTORY_PATTERNS).toBeDefined();
      expect(DENIED_DIRECTORY_PATTERNS.length).toBeGreaterThan(0);
      expect(DENIED_DIRECTORY_PATTERNS).toContain('src/**');
      expect(DENIED_DIRECTORY_PATTERNS).toContain('lib/**');
    });
  });
});
