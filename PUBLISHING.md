# Publishing Guide

## Publishing to npm

The wizard is published as `@belticlabs/wizard` and can be run with:

```bash
npx @belticlabs/wizard
```

## Setup Requirements

### 1. GitHub Secrets

Add these secrets to your GitHub repository settings (`Settings > Secrets and variables > Actions`):

- **`NPM_TOKEN`**: npm authentication token with publish permissions
  - Create at: https://www.npmjs.com/settings/belticlabs/tokens
  - Token type: **Automation token** (allows 2FA override)
  - Permissions: Read and Publish
  - **Important:** Enable "Automation" token type to allow 2FA override for CI/CD

- **`ANTHROPIC_API_KEY`**: Anthropic API key to be compiled into the wizard
  - This allows Beltic to cover API costs for users
  - The key is injected at build time and never appears in source code
  - Get from: https://console.anthropic.com/

### 2. npm Organization Setup

Ensure `@belticlabs` organization exists on npm and you have publish access:

```bash
npm org ls belticlabs
```

If needed, create the organization:
```bash
npm org create belticlabs
```

## Publishing Process

### Automatic Publishing

The wizard automatically publishes when:

1. A commit is pushed to `main` branch
2. The version in `package.json` is higher than the published version on npm
3. The publish workflow runs successfully

### Manual Publishing

To publish manually:

```bash
# 1. Update version in package.json
npm version patch|minor|major

# 2. Build with API key injection (if you have the key locally)
ANTHROPIC_API_KEY=your_key_here pnpm build:with-key

# 3. Publish
pnpm publish --access public
```

**Note:** For production releases, always use the GitHub Actions workflow to ensure the API key is securely injected from GitHub Secrets.

## Version Management

The workflow automatically:

- Compares `package.json` version with published npm version
- Only publishes if the committed version is newer
- Prevents duplicate publishes
- Handles first-time publishing gracefully

## API Key Security

The Anthropic API key is:

- ✅ Stored as a GitHub Secret (encrypted)
- ✅ Injected at build time (not in source code)
- ✅ Compiled into the bundle (users don't need to provide it)
- ✅ Never exposed in git history or source code

The injection script (`scripts/inject-api-key.js`) replaces the empty string fallback with the actual key during the build process.

## Testing Before Publishing

```bash
# Build locally
pnpm build

# Test the built package
node dist/bin.js --help

# Pack and test installation
pnpm pack
npm install -g belticlabs-wizard-*.tgz
wizard --help
```

## Troubleshooting

### "Package version check failed"
- Ensure version in `package.json` is higher than npm published version
- Check npm registry: `npm view @belticlabs/wizard version`

### "NPM_TOKEN not found" or "Authentication failed"
- Add `NPM_TOKEN` secret to GitHub repository
- Ensure token has publish permissions
- Use **Automation token** type (not granular access token) to allow 2FA override
- Verify token is valid: `npm whoami --registry=https://registry.npmjs.org`

### "API key not injected"
- Check `ANTHROPIC_API_KEY` secret exists in GitHub
- Verify the injection script runs: `pnpm build:with-key`
- Check build logs for injection confirmation
