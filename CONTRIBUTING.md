# Contributing to OLLM CLI

Thank you for your interest in contributing to OLLM CLI! This document provides guidelines and standards for contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Naming Conventions](#naming-conventions)
6. [Testing Guidelines](#testing-guidelines)
7. [Commit Messages](#commit-messages)
8. [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 20+ (Node.js 22 LTS recommended)
- npm 10+
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/ollm-cli.git
   cd ollm-cli
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Run tests:
   ```bash
   npm test
   ```

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### Making Changes

1. Make your changes in the appropriate package
2. Add tests for new functionality
3. Update documentation as needed
4. Run linter and formatter:
   ```bash
   npm run lint
   npm run format
   ```
5. Ensure all tests pass:
   ```bash
   npm test
   ```

### Committing Changes

```bash
git add .
git commit -m "feat: add new feature"
git push origin feature/your-feature-name
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Avoid `any` types when possible
- Use explicit return types for functions
- Use interfaces for object shapes
- Use type aliases for unions and complex types

### Import Conventions

**IMPORTANT**: All code must follow the official import conventions documented in [`docs/IMPORT-CONVENTIONS.md`](docs/IMPORT-CONVENTIONS.md).

#### Quick Reference

1. **Node built-ins** (fs, path, os)
2. **External dependencies** (react, ink, npm packages)
3. **Internal dependencies** (@ollm/*, relative imports with .js extension)
4. **Type imports** (always use `import type` syntax)

**Blank lines** between each group, **alphabetical** sorting within groups.

See [`docs/IMPORT-CONVENTIONS.md`](docs/IMPORT-CONVENTIONS.md) for complete details and examples.

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Use trailing commas in multi-line objects/arrays
- Maximum line length: 100 characters

### ESLint and Prettier

All code must pass ESLint and Prettier checks:

```bash
npm run lint        # Check for linting errors
npm run lint -- --fix  # Auto-fix linting errors
npm run format      # Format code with Prettier
```

## Naming Conventions

**IMPORTANT**: All code must follow the official naming conventions documented in [`docs/NAMING-CONVENTIONS.md`](docs/NAMING-CONVENTIONS.md).

### Quick Reference

#### Files
- **Components**: `PascalCase.tsx` (e.g., `ChatTab.tsx`)
- **Services**: `camelCase.ts` (e.g., `contextManager.ts`)
- **Utilities**: `camelCase.ts` (e.g., `keyUtils.ts`)
- **Tests**: Match source file + `.test.ts` (e.g., `contextManager.test.ts`)

#### Functions
- **Exported Functions**: `camelCase` (e.g., `createTestMessage`)
- **React Components**: `PascalCase` (e.g., `ChatTab`)
- **Event Handlers**: `handleCamelCase` (e.g., `handleSubmit`)

#### Variables
- **Constants (primitive)**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Constants (complex)**: `camelCase` (e.g., `defaultConfig`)
- **Regular Variables**: `camelCase` (e.g., `activeWindow`)
- **Boolean Variables**: `is/has/should/can` prefix (e.g., `isActive`)

#### Types and Interfaces
- **Interfaces**: `PascalCase` (e.g., `ServerDetection`)
- **Types**: `PascalCase` (e.g., `WindowType`)
- **Enums**: `PascalCase` (e.g., `FocusLevel`)

### Enforcement

Naming conventions are enforced through:
1. ESLint rules (automated)
2. Code review (manual)
3. Pre-commit hooks (automated)

See [`docs/NAMING-CONVENTIONS.md`](docs/NAMING-CONVENTIONS.md) for complete details.

## Testing Guidelines

### Test Coverage

- Aim for > 80% code coverage
- All new features must include tests
- All bug fixes must include regression tests

### Test Types

1. **Unit Tests**: Test individual functions/classes
2. **Integration Tests**: Test component interactions
3. **Performance Tests**: Test performance-critical code
4. **Property-Based Tests**: Test invariants with fast-check

### Writing Tests

```typescript
// Unit test example
describe('ContextManager', () => {
  it('should add message to context', () => {
    const manager = new ContextManager();
    manager.addMessage('test');
    expect(manager.getMessageCount()).toBe(1);
  });
});

// Integration test example
describe('Chat Flow', () => {
  it('should send message and receive response', async () => {
    const { user } = renderApp();
    await user.type('Hello');
    await user.keyboard('{Enter}');
    expect(screen.getByText(/response/i)).toBeInTheDocument();
  });
});
```

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --watch         # Run tests in watch mode
npm test -- --coverage      # Run tests with coverage
npm test -- contextManager  # Run specific test file
```

## Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(chat): add message streaming support

Implement streaming responses for chat messages using async iterators.
This improves perceived performance and allows for real-time updates.

Closes #123
```

```
fix(context): prevent memory leak in compression service

The compression service was not properly cleaning up event listeners,
causing memory leaks during long sessions.

Fixes #456
```

## Pull Request Process

### Before Submitting

1. **Update Documentation**: Ensure all docs are up to date
2. **Add Tests**: Include tests for new functionality
3. **Run Full Test Suite**: `npm test`
4. **Check Linting**: `npm run lint`
5. **Format Code**: `npm run format`
6. **Update CHANGELOG**: Add entry for your changes

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows naming conventions
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] CHANGELOG updated
- [ ] No TypeScript errors
- [ ] No ESLint warnings
```

### Review Process

1. Submit PR with clear description
2. Address reviewer feedback
3. Ensure CI passes
4. Get approval from maintainer
5. Squash and merge

### CI Checks

All PRs must pass:
- TypeScript compilation
- ESLint checks
- Prettier formatting
- Unit tests
- Integration tests
- Coverage threshold (80%)

## Project Structure

```
ollm-cli/
├── packages/
│   ├── cli/              # CLI entry and UI
│   ├── core/             # Core runtime
│   ├── ollm-bridge/      # Provider adapters
│   └── test-utils/       # Test utilities
├── docs/                 # Documentation
├── scripts/              # Build scripts
└── .dev/                 # Development docs
```

See [`docs/structure.md`](docs/structure.md) for detailed structure.

## Documentation

### Updating Documentation

- Update relevant docs when changing functionality
- Add JSDoc comments to all public APIs
- Include code examples where helpful
- Keep README.md up to date

### Documentation Structure

- `README.md`: Project overview and quick start
- `docs/`: Detailed documentation
- `docs/NAMING-CONVENTIONS.md`: Naming standards
- `.dev/`: Development plans and audits

## Getting Help

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check docs/ directory first

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

## Recognition

Contributors will be recognized in:
- CHANGELOG.md
- GitHub contributors page
- Release notes

Thank you for contributing to OLLM CLI! 🎉
