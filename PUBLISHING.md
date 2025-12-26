# Publishing Guide

## Publishing to npm

The wizard is published as `@belticlabs/wizard` and can be run with:

```bash
npx @belticlabs/wizard
```

## Setup Requirements

### 1. npm Trusted Publishing (OIDC)

**No personal access tokens needed!** This repository uses npm's Trusted Publishing feature, which uses OpenID Connect (OIDC) for secure, tokenless authentication.

#### Setup Steps:

1. **Go to your package on npm:**
   - Visit: https://www.npmjs.com/package/@belticlabs/wizard
   - Or navigate to: https://www.npmjs.com/settings/belticlabs/packages

2. **Add a Trusted Publisher:**
   - Click "Add Trusted Publisher" or go to: https://www.npmjs.com/settings/belticlabs/trusted-publishers
   - Select **GitHub** as the CI/CD provider
   - Enter the following details:
     - **Repository**: `belticlabs/wizard`
     - **Workflow filename**: `.github/workflows/publish.yml`
     - **Environment name**: (leave empty for default)
   - Click "Add Trusted Publisher"

3. **Verify Setup:**
   - The workflow already has `id-token: write` permission configured
   - No `NPM_TOKEN` secret is needed
   - Publishing will automatically use OIDC authentication

**Benefits:**
- ✅ No need to override 2FA on tokens
- ✅ No long-lived tokens to manage
- ✅ Enhanced security with short-lived credentials
- ✅ Automatic provenance attestation

### 2. GitHub Secrets

Add this secret to your GitHub repository settings (`Settings > Secrets and variables > Actions`):

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

### "Authentication failed" or "Unauthorized"
- Verify Trusted Publishing is configured on npm
- Check that the repository name matches exactly: `belticlabs/wizard`
- Ensure workflow filename is correct: `.github/workflows/publish.yml`
- Verify `id-token: write` permission is set in the workflow (already configured)

### "API key not injected"
- Check `ANTHROPIC_API_KEY` secret exists in GitHub
- Verify the injection script runs: `pnpm build:with-key`
- Check build logs for injection confirmation
