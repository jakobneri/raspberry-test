# Contributing to Raspberry Pi Server Manager

Thank you for your interest in contributing to this project! This document provides guidelines for contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a branch** for your changes
4. **Make your changes** following the guidelines below
5. **Test your changes** thoroughly
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- TypeScript 5.7+
- For Raspberry Pi features: Raspberry Pi OS with systemd

### Installation

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Building

```bash
# Build backend TypeScript
npm run build

# Build frontend Angular app
cd frontend
npm run build
cd ..
```

### Running Locally

```bash
# Start the server
npm start

# Or for development with rebuild
npm run dev
```

The server will be available at `http://localhost:3000`

## Code Style

### Backend (TypeScript)

- **Strict mode**: Always use TypeScript strict mode
- **ES Modules**: Use ES module imports (`import X from "Y"`)
- **File extensions**: Always use `.js` extension in imports (e.g., `from "./router.js"`)
- **Naming**:
  - Variables/Functions: `camelCase`
  - Interfaces/Types: `PascalCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.service.ts`

### Linting and Formatting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Frontend (Angular)

- Follow the Angular style guide
- Use standalone components
- Use TypeScript for all component logic

## Security Guidelines

### Critical Security Rules

1. **Never** commit secrets or API keys
2. **Always** validate user input
3. **Always** sanitize file paths (use `basename()`)
4. **Never** use string interpolation for shell commands (use `execFile` with array arguments)
5. **Always** add rate limiting to authentication endpoints
6. **Always** set appropriate file size limits for uploads
7. **Always** use parameterized queries for database operations

### Input Validation

- Use Zod for runtime validation where possible
- Validate all user inputs on the backend
- Check for path traversal attempts (`..`)
- Validate file types and sizes
- Sanitize filenames

### Command Execution

```typescript
// ❌ NEVER do this (command injection vulnerability)
await execAsync(`sudo nmcli connect "${ssid}"`);

// ✅ ALWAYS do this (safe)
await execFileAsync("sudo", ["nmcli", "connect", ssid]);
```

## Testing

Currently, the project doesn't have automated tests. When adding tests:

- Add test files next to the code they test
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies

## Pull Request Process

1. **Update the README** if you're adding new features
2. **Follow the code style** guidelines
3. **Test your changes** thoroughly
4. **Update documentation** as needed
5. **Keep commits focused** - one feature/fix per PR
6. **Write clear commit messages**:
   - Use present tense ("Add feature" not "Added feature")
   - First line: brief summary (50 chars or less)
   - Body: detailed explanation if needed

### Commit Message Format

```
Short summary of changes (50 chars max)

Detailed explanation of what changed and why.
- Bullet points are fine
- Reference issues with #123

Security: Note any security implications
Breaking: Note any breaking changes
```

## Code Review

All submissions require review. We'll:

- Check code quality and style
- Verify security best practices
- Test functionality
- Suggest improvements

## Bug Reports

When filing a bug report, include:

- **Description**: Clear description of the issue
- **Steps to reproduce**: Exact steps to trigger the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: OS, Node version, etc.
- **Logs**: Relevant error messages or logs

## Feature Requests

For feature requests, describe:

- **Use case**: Why is this needed?
- **Proposed solution**: How should it work?
- **Alternatives**: Other approaches considered
- **Implementation notes**: Technical considerations

## Questions?

- Open an issue for questions about the code
- Check existing issues and documentation first

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (ISC).
