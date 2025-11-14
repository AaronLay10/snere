# Contributing to Sentient Engine

Thank you for your interest in contributing to Sentient Engine! This document provides guidelines and best practices for development.

## Table of Contents

- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Development Setup

### Prerequisites

- **Node.js:** v22.0.0 or higher
- **npm:** v10.0.0 or higher
- **Docker:** Latest version with Docker Compose
- **Git:** Latest version

### Initial Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/AaronLay10/sentient.git
   cd sentient
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Copy environment file:**

   ```bash
   cp services/api/.env.example services/api/.env
   # Edit .env with your local configuration
   ```

4. **Start development environment:**

   ```bash
   npm run dev
   ```

5. **Seed development database:**

   ```bash
   npm run db:seed
   ```

6. **Verify health:**
   ```bash
   ./scripts/health-check.sh
   ```

### VS Code Setup

We highly recommend using Visual Studio Code with the recommended extensions:

1. Open the workspace in VS Code
2. Install recommended extensions (you'll be prompted)
3. Enable format on save (already configured in `.vscode/settings.json`)

## Development Workflow

### Starting Work

```bash
# Start all services
npm run dev

# Or start with fresh build
npm run dev:build

# View logs
npm run dev:logs
```

### Making Changes

1. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our code standards

3. **Run tests frequently:**

   ```bash
   npm test              # All tests
   npm run test:watch    # Watch mode
   ```

4. **Format and lint:**
   ```bash
   npm run format        # Auto-format all files
   npm run lint          # Check for issues
   npm run lint:fix      # Auto-fix issues
   ```

### Testing Your Changes

```bash
# API tests
cd services/api && npm test

# Frontend tests
cd services/sentient-web && npm test

# Integration tests
cd services/api && npm run test:integration

# Build verification
npm run build
```

### Debugging

Use VS Code's built-in debugger:

1. Press `F5` or use Debug panel
2. Select "Attach to All Services"
3. Set breakpoints in TypeScript files
4. Debug with hot-reload support

## Code Standards

### Naming Conventions

**CRITICAL: Use snake_case for ALL system identifiers:**

```typescript
// ✅ Correct
interface Device {
  device_id: string;
  room_id: string;
  friendly_name: string;
}

// ❌ Incorrect
interface Device {
  deviceId: string;
  roomId: string;
  friendlyName: string;
}
```

**Why snake_case?**

- PostgreSQL standard
- MQTT topic standard
- No conversion between layers
- Consistency across entire stack

### TypeScript Standards

- **Strict mode:** Always enabled
- **Explicit types:** Avoid `any`, use proper types
- **Return types:** Always specify for functions
- **Imports:** Use `.js` extension for ESM compatibility

```typescript
// ✅ Good
export async function getDevice(deviceId: string): Promise<Device | null> {
  const result = await query<Device>('SELECT * FROM devices WHERE id = $1', [deviceId]);
  return result.rows[0] || null;
}

// ❌ Bad
export async function getDevice(deviceId) {
  const result = await query('SELECT * FROM devices WHERE id = $1', [deviceId]);
  return result.rows[0] || null;
}
```

### MQTT Topic Structure

```
[client]/[room]/[category]/[controller]/[device]/[item]
```

- **Categories:** `commands/`, `sensors/`, `status/`, `events/` (lowercase)
- **Identifiers:** snake_case from database
- **Never:** Display names or hyphens

### Multi-Tenant Safety

**Every database query MUST filter by client_id:**

```typescript
// ✅ Correct
const devices = await query(
  `SELECT d.* FROM devices d
   JOIN rooms r ON d.room_id = r.id
   WHERE r.client_id = $1`,
  [clientId]
);

// ❌ Incorrect - Missing client_id filter!
const devices = await query('SELECT * FROM devices');
```

### Error Handling

```typescript
// Use try-catch with structured logging
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', {
    error: error.message,
    stack: error.stack,
    context: {
      /* relevant data */
    },
  });
  throw error; // or return appropriate response
}
```

## Testing Requirements

### Coverage Requirements

- **Critical paths:** 80% coverage minimum
- **Utilities:** 50% coverage minimum
- **Overall:** 50% coverage minimum

### Test Structure

```
services/api/src/__tests__/
├── unit/           # Unit tests for individual functions
└── integration/    # Integration tests with database/MQTT

services/sentient-web/src/
└── components/__tests__/  # Component tests
```

### Writing Tests

**Unit Test Example:**

```typescript
describe('Auth Middleware', () => {
  it('should hash a password', async () => {
    const password = 'test_password_123';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
  });
});
```

**Integration Test Example:**

```typescript
describe('Auth Routes', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

### Running Tests

```bash
# All tests
npm test

# Specific service
cd services/api && npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage
```

## Commit Guidelines

### Commit Message Format

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
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(api): add device status endpoint

Add GET /api/devices/:id/status endpoint to retrieve real-time
device status from MQTT telemetry cache.

Closes #123
```

```
fix(mqtt): correct topic parsing for nested devices

Fixed topic parsing to handle multi-level device hierarchies
in MQTT topic structure.
```

### Pre-commit Hooks

Husky automatically runs on commit:

- Prettier formatting
- ESLint fixes
- Type checking (on staged files)

## Pull Request Process

### Before Creating PR

1. ✅ All tests pass
2. ✅ Code is formatted (automatic via Husky)
3. ✅ No linting errors
4. ✅ Type checking passes
5. ✅ Documentation updated (if needed)
6. ✅ Database migrations created (if schema changed)

### Creating a PR

1. **Push your branch:**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR on GitHub** with:
   - Clear title describing the change
   - Description of what changed and why
   - Screenshots (if UI changes)
   - Testing steps
   - Related issues (if any)

3. **Wait for CI checks** to pass (GitHub Actions)

4. **Request review** from maintainers

### PR Review Process

- At least one approval required
- All CI checks must pass
- No merge conflicts
- Branch must be up to date with main

### After Merge

1. Delete your feature branch
2. Pull latest main: `git checkout main && git pull`
3. Your changes will be deployed in the next release

## Code Review Guidelines

### As a Reviewer

- Be constructive and kind
- Focus on code quality, not style (automated)
- Test the changes locally if significant
- Ask questions if unclear
- Approve when satisfied

### As an Author

- Respond to all comments
- Make requested changes promptly
- Ask for clarification if needed
- Keep PRs focused and reasonably sized

## Questions or Issues?

- Check [DEVELOPER_ONBOARDING.md](./docs/DEVELOPER_ONBOARDING.md) for setup help
- Review [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) for architecture details
- Open an issue for bugs or questions
- Contact maintainers for access/permissions

## License

This project is UNLICENSED - proprietary software for Sentient Engine.
