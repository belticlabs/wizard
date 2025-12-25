# Beltic Wizard Context

## Project Identity

**Name**: Beltic Wizard  
**Purpose**: A Claude-powered CLI tool that automatically analyzes AI agent codebases and generates Beltic credentials, manifests, and signatures. Provides a single-command setup experience for developers.  
**Core Value**: Automated, intelligent credential bootstrap with minimal developer effort.  
**Mechanism**:
- Codebase Analysis: Uses Claude AI to detect language, framework, and structure
- Configuration Generation: Creates optimal `.beltic.yaml` patterns
- Credential Creation: Orchestrates Beltic CLI commands to create and sign credentials
- File Updates: Automatically updates `.gitignore` and `README.md`

## Quick Commands

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development mode
pnpm try --install-dir /path/to/agent

# Run tests
pnpm test

# Watch mode (rebuild on changes)
pnpm build:watch

# Lint
pnpm lint

# Fix linting issues
pnpm fix
```

## Stack

- **Language**: TypeScript 5.0+
- **Runtime**: Node.js >= 18.0.0
- **Package Manager**: pnpm 10.23+
- **CLI Framework**: yargs 16.2+
- **Prompts**: @clack/prompts 0.7+
- **AI Integration**: @anthropic-ai/sdk 0.39+ (Claude API)
- **File Operations**: fast-glob 3.3+, glob 9.3+
- **YAML**: js-yaml 4.1+
- **HTTP**: axios 1.7+
- **Testing**: Jest 29.5+ with ts-jest
- **Linting**: ESLint 8.18+ with TypeScript ESLint
- **Formatting**: Prettier 2.8+

## Project Structure

```
wizard/
├── src/
│   ├── run.ts              # Main entry point, orchestrates workflow
│   ├── bin.ts              # CLI entry point
│   ├── beltic/             # Beltic CLI integration
│   │   ├── detector.ts     # Codebase detection (language, framework, etc.)
│   │   ├── cli.ts          # Beltic CLI command execution
│   │   ├── yaml-generator.ts # .beltic.yaml generation
│   │   ├── manifest.ts     # Manifest analysis and patching
│   │   ├── schema.ts       # Schema validation
│   │   ├── gitignore.ts    # .gitignore management
│   │   └── readme.ts       # README.md updates
│   ├── lib/                # Core libraries
│   │   ├── api.ts          # KYA API client
│   │   ├── constants.ts    # Constants and configuration
│   │   ├── credentials.ts  # Credential storage/loading
│   │   ├── kya-oauth.ts    # OAuth authentication
│   │   ├── workos-oauth.ts # WorkOS OAuth flow
│   │   ├── prompts.ts      # User prompts
│   │   └── agent-interface.ts # Agent detection interface
│   └── utils/              # Utilities
│       ├── clack.ts        # Clack prompt wrappers
│       ├── clack-utils.ts  # Clack utilities
│       ├── bash.ts         # Bash command execution
│       ├── environment.ts  # Environment variable handling
│       ├── package-json.ts # package.json parsing
│       ├── package-manager.ts # Package manager detection
│       ├── semver.ts       # Version comparison
│       ├── string.ts       # String utilities
│       ├── logging.ts      # Logging utilities
│       ├── debug.ts        # Debug logging
│       ├── errors.ts       # Error handling
│       └── rules/          # Framework-specific rules
│           ├── next-rules.md
│           ├── react-rules.md
│           └── ...
├── bin/                    # Shell scripts
├── dist/                   # Compiled output
├── bin.ts                  # Binary entry point
└── index.ts                # Package exports
```

## Commands

### Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Build in watch mode
pnpm build:watch

# Run locally (development)
pnpm try --install-dir /path/to/agent

# Run with tsx (no build)
pnpm try --install-dir /path/to/agent
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test detector.test.ts
```

### Code Quality

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm fix

# Format code
pnpm fix:prettier

# Fix ESLint issues
pnpm fix:eslint
```

### Publishing

```bash
# Build before publishing
pnpm build

# Publish to npm (requires authentication)
npm publish
```

## Testing

### Test Structure

- **Unit tests**: `src/**/__tests__/*.test.ts`
- **Test utilities**: Shared test helpers
- **Fixtures**: Test data in test files

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Specific test
pnpm test detector.test.ts
```

### Test Examples

```typescript
// Example from src/beltic/__tests__/detector.test.ts
import { describe, it, expect } from '@jest/globals';
import { detectCodebase } from '../detector';

describe('detectCodebase', () => {
  it('should detect TypeScript project', async () => {
    const result = await detectCodebase('/path/to/ts-project');
    expect(result.language).toBe('typescript');
    expect(result.deploymentType).toBe('standalone');
  });
});
```

## Code Style

### TypeScript Configuration

- **Strict mode**: Enabled
- **Module**: ES modules
- **Target**: ES2022
- **Module resolution**: Node16

### Naming Conventions

- **Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE` or `camelCase` for exported
- **Files**: `kebab-case.ts` or `camelCase.ts`

### Code Examples

```typescript
// Good: Clear async/await, proper error handling
export async function detectCodebase(
  installDir: string
): Promise<DetectionResult> {
  const language = await detectLanguage(installDir);
  const deploymentType = await detectDeploymentType(installDir);
  return {
    language,
    deploymentType,
    // ...
  };
}

// Good: Use clack for user interaction
import clack from './utils/clack';

const shouldContinue = await clack.confirm({
  message: 'Continue with setup?',
  initialValue: true,
});

if (clack.isCancel(shouldContinue)) {
  clack.cancel('Setup cancelled');
  process.exit(0);
}
```

### Error Handling

```typescript
// Use custom error classes
import { WizardError } from './utils/errors';

try {
  await runBelticInit(options);
} catch (error) {
  if (error instanceof WizardError) {
    clack.log.error(error.message);
  } else {
    clack.log.error('Unexpected error:', error);
  }
  process.exit(1);
}
```

## Git Workflow

### Commits

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Keep commits focused and atomic
- Write clear commit messages

```bash
# Good commit messages
git commit -m "feat: add Python codebase detection"
git commit -m "fix: handle missing package.json gracefully"
git commit -m "docs: update README with OAuth flow"
```

### Releases

- Version in `package.json` follows semantic versioning
- Update `CHANGELOG.md` for each release
- Tag releases: `v0.1.0`

## Boundaries

### Never Commit

- **API keys** (use environment variables)
- **Credentials** (`~/.beltic/credentials.json`)
- **Test agent directories** with real credentials
- **node_modules/** (use pnpm-lock.yaml)
- **dist/** (build artifacts)

### Security Rules

1. **Never log sensitive data**: API keys, tokens, credentials
2. **Store credentials securely**: Use `~/.beltic/credentials.json` with restricted permissions
3. **Validate inputs**: Check file paths, validate YAML/JSON
4. **Error messages**: Don't leak sensitive information
5. **OAuth tokens**: Store securely, handle expiration

### What This Repo Does

- ✅ Analyzes codebases using Claude AI
- ✅ Generates `.beltic.yaml` configuration
- ✅ Creates agent manifests via Beltic CLI
- ✅ Generates cryptographic keypairs
- ✅ Signs credentials
- ✅ Updates `.gitignore` and `README.md`
- ✅ Authenticates with KYA platform via OAuth

### What This Repo Doesn't Do

- ❌ Issue credentials (delegates to KYA platform)
- ❌ Store credentials long-term (only during setup)
- ❌ Provide a credential database
- ❌ Handle ongoing credential management (use beltic-cli)

## Examples

### Adding a New Language Detector

```typescript
// src/beltic/detector.ts
async function detectLanguage(installDir: string): Promise<Language> {
  // Check for Python
  if (await fileExists(path.join(installDir, 'pyproject.toml'))) {
    return 'python';
  }
  
  // Check for TypeScript
  if (await fileExists(path.join(installDir, 'tsconfig.json'))) {
    return 'typescript';
  }
  
  // Add new language detection...
  return 'unknown';
}
```

### Using Claude API

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || DEFAULT_API_KEY,
});

const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: 'Analyze this codebase and generate .beltic.yaml...',
  }],
});
```

### Running Beltic CLI Commands

```typescript
import { exec } from './utils/bash';

async function runBelticInit(options: InitOptions): Promise<void> {
  const args = [
    'init',
    '--output', options.output,
    '--non-interactive',
  ];
  
  await exec('beltic', args, {
    cwd: options.installDir,
  });
}
```

### OAuth Flow

```typescript
import { performBelticOAuth } from './lib/workos-oauth';

// Start OAuth flow
const tokenResponse = await performBelticOAuth();

// Token includes access_token and refresh_token
const { access_token } = tokenResponse;

// Use token to fetch developer data
const developer = await fetchDeveloperData(access_token, KYA_API_URL);
```

## Common Workflows

### Complete Setup Flow

1. **Authenticate**: `authenticateWithKya()` - OAuth with KYA platform
2. **Detect**: `detectCodebase()` - Analyze codebase structure
3. **Generate YAML**: `generateBelticYaml()` - Create `.beltic.yaml` with Claude
4. **Initialize**: `runBelticInit()` - Create `agent-manifest.json`
5. **Fingerprint**: `runBelticFingerprint()` - Generate code fingerprint
6. **Generate Keys**: `runBelticKeygen()` - Create Ed25519 keypair
7. **Sign**: `runBelticSign()` - Sign credential as JWT
8. **Update Files**: `updateGitignore()`, `updateReadme()`

### Adding Framework Detection

```typescript
// src/beltic/detector.ts
async function detectDeploymentType(
  installDir: string
): Promise<DeploymentType> {
  // Check for Next.js
  if (await fileExists(path.join(installDir, 'next.config.js'))) {
    return 'standalone';
  }
  
  // Check for monorepo
  if (await fileExists(path.join(installDir, 'pnpm-workspace.yaml'))) {
    return 'monorepo';
  }
  
  // Add new detection...
  return 'standalone';
}
```

### Debugging

```typescript
import { debug, initLogFile } from './utils/debug';

// Initialize debug logging
initLogFile();

// Log debug information
debug('Detected language:', language);
debug('Deployment type:', deploymentType);

// Log file is written to ~/.beltic/wizard-debug.log
```

### Error Handling

```typescript
import { WizardError } from './utils/errors';
import { abort } from './utils/clack-utils';

try {
  await runBelticInit(options);
} catch (error) {
  if (error instanceof WizardError) {
    clack.log.error(error.message);
    await abort();
  } else {
    clack.log.error('Unexpected error occurred');
    debug('Error details:', error);
    await abort();
  }
  process.exit(1);
}
```

