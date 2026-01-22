# Code Editor - Syntax Highlighting & Error Detection

**Date**: January 22, 2026  
**Status**: 📋 Specification Update

## Overview

Enhanced the Code Editor specification to include detailed syntax highlighting with semantic colors and TypeScript/ESLint error detection.

## Syntax Highlighting Color Scheme

### Color Mapping

| Element | Color | ANSI Code | Examples |
|---------|-------|-----------|----------|
| **Strings** | Green | `\x1b[32m` | `"text"`, `'text'`, `` `template` `` |
| **Comments** | Gray | `\x1b[90m` | `// comment`, `/* block */` |
| **Numbers** | Yellow | `\x1b[33m` | `123`, `3.14`, `0xFF` |
| **Parameters** | Yellow | `\x1b[33m` | Function params, object properties |
| **Keywords** | Purple/Magenta | `\x1b[35m` | `var`, `if`, `else`, `const`, `class`, `return` |
| **Operators** | Light-blue/Cyan | `\x1b[36m` | `+`, `-`, `&&`, `\|\|`, `===`, `=>` |
| **Functions** | Dark-blue | `\x1b[34m` | Function names, method calls |
| **Classes** | Red | `\x1b[31m` | Class names, `this` keyword |
| **Types** | Cyan | `\x1b[36m` | TypeScript types, interfaces |
| **Errors** | Bright Red | `\x1b[91m` | Error underlines |
| **Warnings** | Bright Yellow | `\x1b[93m` | Warning underlines |
| **Default** | White | `\x1b[37m` | Default text |

### Visual Example

```typescript
// TypeScript code with color annotations

const message: string = "Hello World";
// ^^^^^ keyword (purple)
//    ^^^^^^^ variable (white)
//           ^ operator (cyan)
//             ^^^^^^ type (cyan)
//                    ^ operator (cyan)
//                      ^^^^^^^^^^^^^ string (green)

function greet(name: string): void {
// ^^^^^^^^ keyword (purple)
//         ^^^^^ function name (blue)
//              ^^^^ parameter (yellow)
//                  ^ operator (cyan)
//                    ^^^^^^ type (cyan)
//                          ^ operator (cyan)
//                            ^^^^ type (cyan)
  return `Hi, ${name}!`;
  // ^^^^^^ keyword (purple)
  //       ^^^^^^^^^^^^^^ string (green)
}

class User {
// ^^^^^ keyword (purple)
//    ^^^^ class name (red)
  constructor(public name: string) {
  // ^^^^^^^^^^^ function name (blue)
  //          ^^^^^^ keyword (purple)
  //                 ^^^^ parameter (yellow)
  //                     ^ operator (cyan)
  //                       ^^^^^^ type (cyan)
    this.name = name;
    // ^^^^ this keyword (red)
  }
}

// Error highlighting
const x: number = "text";  // ❌ Type error
//                ^^^^^^ (bright red underline)
//                       Error: Type 'string' not assignable to 'number'
```

## Error and Warning Highlighting

### Error Types

1. **TypeScript Errors** (Red underlines)
   - Type mismatches
   - Missing properties
   - Invalid assignments
   - Syntax errors

2. **ESLint Warnings** (Yellow underlines)
   - Unused variables
   - Missing semicolons
   - Code style issues
   - Best practice violations

### Error Display

```
Line 42 │ const x: number = "text";
        │                   ^^^^^^ Type 'string' is not assignable to type 'number'
        │                   (TypeScript error)

Line 45 │ let unused = 123;
        │     ^^^^^^ 'unused' is assigned a value but never used
        │     (ESLint warning)
```

### Error Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl+E` | Jump to next error |
| `Shift+Ctrl+E` | Jump to previous error |

### Status Bar

```
┌─────────────────────────────────────────────────────────────┐
│ 📄 file.ts [Modified] | Line 42/150 | Col 12 | ❌ 2 errors  │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### EditorSyntax Service

```typescript
class EditorSyntax {
  // Syntax highlighting
  highlight(content: string, language: string): HighlightedContent;
  detectLanguage(filePath: string): string | null;
  getSupportedLanguages(): string[];
  applyColorScheme(tokens: Token[]): ColoredTokens;
  
  // Color scheme
  private colorScheme: SyntaxColorScheme = {
    strings: 'green',
    comments: 'gray',
    numbers: 'yellow',
    parameters: 'yellow',
    keywords: 'magenta',
    operators: 'cyan',
    functions: 'blue',
    classes: 'red',
    types: 'cyan',
    errors: 'redBright',
    warnings: 'yellowBright',
    default: 'white',
  };
}
```

### EditorDiagnostics Service

```typescript
interface EditorDiagnostic {
  line: number;
  column: number;
  length: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: 'typescript' | 'eslint';
}

class EditorDiagnostics {
  // Get diagnostics for current file
  getDiagnostics(filePath: string, content: string): Promise<EditorDiagnostic[]>;
  
  // Highlight errors in editor
  highlightErrors(diagnostics: EditorDiagnostic[]): void;
  
  // Navigate errors
  jumpToNextError(): void;
  jumpToPreviousError(): void;
  
  // Error count
  getErrorCount(): number;
  getWarningCount(): number;
}
```

### Integration with TypeScript

```typescript
// Use TypeScript language server for error detection
import * as ts from 'typescript';

async function getTypeScriptDiagnostics(
  filePath: string,
  content: string
): Promise<EditorDiagnostic[]> {
  const program = ts.createProgram([filePath], {
    noEmit: true,
    target: ts.ScriptTarget.ES2020,
  });
  
  const diagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ];
  
  return diagnostics.map(d => ({
    line: ts.getLineAndCharacterOfPosition(d.file!, d.start!).line,
    column: ts.getLineAndCharacterOfPosition(d.file!, d.start!).character,
    length: d.length || 1,
    severity: d.category === ts.DiagnosticCategory.Error ? 'error' : 'warning',
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    source: 'typescript',
  }));
}
```

### Integration with ESLint

```typescript
// Use ESLint for linting
import { ESLint } from 'eslint';

async function getESLintDiagnostics(
  filePath: string,
  content: string
): Promise<EditorDiagnostic[]> {
  const eslint = new ESLint();
  const results = await eslint.lintText(content, { filePath });
  
  return results[0].messages.map(m => ({
    line: m.line - 1,  // ESLint is 1-based
    column: m.column - 1,
    length: m.endColumn ? m.endColumn - m.column : 1,
    severity: m.severity === 2 ? 'error' : 'warning',
    message: m.message,
    source: 'eslint',
  }));
}
```

## User Stories

### US-9: Syntax Highlighting
**As a** developer  
**I want to** see syntax-highlighted code with semantic colors  
**So that** I can read and understand the code more easily

**Acceptance Criteria**:
- ✅ Syntax highlighting applied based on file extension
- ✅ Reuses existing SyntaxViewer's shiki integration
- ✅ Supports 50+ programming languages
- ✅ Highlighting updates as user types (debounced 500ms)
- ✅ Falls back to plain text if language not supported
- ✅ **Specific color scheme**:
  - Green: Strings
  - Gray: Comments
  - Yellow: Numbers, parameters
  - Purple: Keywords
  - Cyan: Operators, types
  - Blue: Functions
  - Red: Classes, this
  - White: Default

### US-9b: Error and Warning Highlighting
**As a** developer  
**I want to** see TypeScript and lint errors highlighted in the editor  
**So that** I can fix issues as I type

**Acceptance Criteria**:
- ✅ TypeScript errors shown with red underlines
- ✅ ESLint warnings shown with yellow underlines
- ✅ Error messages displayed inline or on hover
- ✅ Errors update as user types (debounced 1000ms)
- ✅ Error count shown in status bar
- ✅ Ctrl+E jumps to next error
- ✅ Shift+Ctrl+E jumps to previous error
- ✅ Works for TypeScript, JavaScript, and other supported languages
- ✅ Integrates with existing getDiagnostics tool if available

## Implementation Tasks

### Task 28: Implement EditorSyntax Service (6 hours)
- [x] Reuse SyntaxViewer's shiki integration
- [x] Implement detectLanguage(filePath)
- [x] Implement highlight(content, language)
- [x] Implement applyColorScheme(tokens)
- [x] **Color scheme**:
  - [x] Green for strings
  - [x] Gray for comments
  - [x] Yellow for numbers and parameters
  - [x] Purple for keywords
  - [x] Cyan for operators and types
  - [x] Blue for functions
  - [x] Red for classes and this
  - [x] White for default
- [x] Convert shiki output to terminal ANSI codes
- [x] Cache highlighted content
- [x] Debounce updates (500ms)
- [x] **Error highlighting**:
  - [x] Create EditorDiagnostics service
  - [x] Integrate with TypeScript language server
  - [x] Red underlines for errors
  - [x] Yellow underlines for warnings
  - [x] Error messages inline
  - [x] Debounced error checking (1000ms)

### Task 29: Integrate Syntax Highlighting (5 hours)
- [x] Apply highlighting to visible lines
- [x] Detect language from file extension
- [x] Update highlighting as user types
- [x] Plain text fallback
- [x] Performance optimization
- [x] **Color scheme visible**:
  - [x] All colors render correctly
- [x] **Error highlighting integrated**:
  - [x] Errors with red underlines
  - [x] Warnings with yellow underlines
  - [x] Error messages inline
  - [x] Error count in status bar
  - [x] Ctrl+E navigation
  - [x] Shift+Ctrl+E navigation

## Dependencies

### Existing
- ✅ `shiki` - Syntax highlighting (already installed)
- ✅ `typescript` - TypeScript compiler (already installed)

### New
- ⏳ `eslint` - Linting (may need to install)
- ⏳ `@typescript/vfs` - TypeScript virtual file system (optional)

## Performance Considerations

### Syntax Highlighting
- Debounce: 500ms after last keystroke
- Only highlight visible lines
- Cache highlighted content
- Reuse shiki highlighter instance

### Error Detection
- Debounce: 1000ms after last keystroke
- Run in background thread if possible
- Cache diagnostics
- Only check current file (not whole project)
- Limit to 100 errors max

## Testing

### Unit Tests
- Color scheme mapping
- ANSI code generation
- Language detection
- Error parsing

### Integration Tests
- Syntax highlighting updates on typing
- Error highlighting appears correctly
- Error navigation works
- Status bar updates

### Visual Tests
- All colors render correctly in terminal
- Errors are clearly visible
- Performance is acceptable

## Future Enhancements

1. **Hover Information**: Show type info on hover
2. **Autocomplete**: Suggest completions based on context
3. **Go to Definition**: Jump to symbol definition
4. **Find References**: Find all usages of symbol
5. **Refactoring**: Rename symbol, extract function
6. **Code Actions**: Quick fixes for errors

## References

- Shiki Documentation: https://shiki.matsu.io/
- TypeScript Compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
- ESLint Node.js API: https://eslint.org/docs/latest/integrate/nodejs-api
- ANSI Color Codes: https://en.wikipedia.org/wiki/ANSI_escape_code

---

**Status**: ✅ Specification updated with syntax highlighting and error detection  
**Next**: Implement EditorSyntax and EditorDiagnostics services
