# Publishing Guide

## Publishing to npm

The wizard is published as `@belticlabs/wizard` and can be run with:

```bash
npx @belticlabs/wizard
```

## Setup Requirements

### 1. npm Trusted Publishing (OIDC)

**No personal access tokens needed for automated publishing!** This repository uses npm's Trusted Publishing feature, which uses OpenID Connect (OIDC) for secure, tokenless authentication.

#### First-Time Setup (Package Doesn't Exist Yet)

**Important:** npm requires the package to exist before you can add a Trusted Publisher. Follow these steps:

#### Step 1: Initial Manual Publish

For the first publish only, you'll need to publish manually using npm authentication:

1. **Login to npm:**
   ```bash
   npm login
   # Or use an automation token temporarily
   npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
   ```

2. **Build with API key:**
   ```bash
   # Set your Anthropic API key
   export ANTHROPIC_API_KEY=your_key_here
   
   # Build with key injection
   pnpm build:with-key
   ```

3. **Publish manually:**
   ```bash
   pnpm publish --access public
   ```

This creates the package on npm so you can configure Trusted Publishing.

#### Step 2: Configure Trusted Publishing

**Option A: Organization-Level (Recommended - Can be done before first publish)**

You can add a Trusted Publisher at the organization level, which applies to all packages in the `@belticlabs` scope:

1. **Go to organization settings:**
   - Visit: https://www.npmjs.com/settings/belticlabs/trusted-publishers
   - Or navigate: npmjs.com → Settings → Organizations → belticlabs → Trusted Publishers

2. **Add a Trusted Publisher:**
   - Click "Add Trusted Publisher"
   - Select **GitHub** as the CI/CD provider
   - Enter the following details:
     - **Repository**: `belticlabs/wizard`
     - **Workflow filename**: `.github/workflows/publish.yml`
     - **Environment name**: (leave empty for default)
   - Click "Add Trusted Publisher"

**Option B: Package-Level (After first publish)**

Alternatively, you can add it at the package level after the first publish:

1. **Go to your package on npm:**
   - Visit: https://www.npmjs.com/package/@belticlabs/wizard
   - Click on "Trusted Publishers" tab

2. **Add a Trusted Publisher:**
   - Click "Add Trusted Publisher"
   - Select **GitHub** as the CI/CD provider
   - Enter the same details as above

3. **Verify Setup:**
   - The workflow already has `id-token: write` permission configured
   - No `NPM_TOKEN` secret is needed for future publishes
   - All future publishing will automatically use OIDC authentication

**Benefits:**
- ✅ No need to override 2FA on tokens (after initial setup)
- ✅ No long-lived tokens to manage (after initial setup)
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
- **First publish:** You must publish manually once before Trusted Publishing can be configured (see "First-Time Setup" above)
- **After first publish:** Verify Trusted Publishing is configured on npm
- Check that the repository name matches exactly: `belticlabs/wizard`
- Ensure workflow filename is correct: `.github/workflows/publish.yml`
- Verify `id-token: write` permission is set in the workflow (already configured)
- If package doesn't exist yet, you'll need to do the initial manual publish first

### "API key not injected"
- Check `ANTHROPIC_API_KEY` secret exists in GitHub
- Verify the injection script runs: `pnpm build:with-key`
- Check build logs for injection confirmation
