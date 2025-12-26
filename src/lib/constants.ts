import * as path from 'path';
import * as os from 'os';

export const IS_DEV = ['test', 'development'].includes(
  process.env.NODE_ENV ?? '',
);

export const DEBUG = false;

// Beltic Schema URLs
export const BELTIC_SPEC_BASE_URL =
  'https://raw.githubusercontent.com/belticlabs/beltic-spec/main';
export const AGENT_CREDENTIAL_SCHEMA_URL = `${BELTIC_SPEC_BASE_URL}/schemas/agent/v2/agent-credential-v2.schema.json`;
export const DEVELOPER_CREDENTIAL_SCHEMA_URL = `${BELTIC_SPEC_BASE_URL}/schemas/developer/v2/developer-credential-v2.schema.json`;

// Beltic CLI
export const BELTIC_CLI_HOMEBREW_TAP = 'belticlabs/tap';
export const BELTIC_CLI_HOMEBREW_FORMULA = 'beltic';
export const BELTIC_CLI_INSTALL_SCRIPT_URL =
  'https://raw.githubusercontent.com/belticlabs/beltic-cli/master/install.sh';

// GitHub URLs
export const ISSUES_URL = 'https://github.com/belticlabs/wizard/issues';
export const DOCS_URL = 'https://github.com/belticlabs/beltic-spec';

// OAuth Configuration
export const OAUTH_PORT = 8239;

// Console URL (serves both web UI and API endpoints for CLI tools)
// Can be overridden via environment variables for local development
export const KYA_API_URL =
  process.env.KYA_API_URL || 'https://console.beltic.app';

// Legacy auth URL (now handled by WorkOS directly)
export const KYA_AUTH_URL =
  process.env.KYA_AUTH_URL || 'https://console.beltic.app';
export const KYA_CLIENT_ID = process.env.KYA_CLIENT_ID || '';

// WorkOS Configuration for OAuth
// Client ID is safe to hardcode - it's a public identifier, not a secret
// PKCE flow doesn't require a client secret for CLI tools
export const WORKOS_CLIENT_ID =
  process.env.WORKOS_CLIENT_ID || 'client_01KD6DX6TJ0SVR510DQ5WSTWTR';

// Anthropic API Configuration
// API key must be provided via ANTHROPIC_API_KEY env var or --anthropic-key flag
// For Beltic's managed service, the API key is injected at runtime
export const DEFAULT_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Anthropic model used for codebase analysis
export const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

// Credential storage paths
export const BELTIC_CONFIG_DIR = path.join(os.homedir(), '.beltic');
export const CREDENTIALS_FILE = path.join(
  BELTIC_CONFIG_DIR,
  'credentials.json',
);

// Event name for analytics (if we add analytics later)
export const WIZARD_INTERACTION_EVENT_NAME = 'beltic wizard interaction';

/**
 * Placeholder issuer DID for self-signed credentials.
 *
 * TODO: Replace with actual platform-issued DIDs once the Beltic platform is ready.
 *
 * In production:
 * - Developer registers on Beltic platform
 * - Platform issues a developer DID (did:beltic:dev:xxx)
 * - Developer uses their DID to sign agent credentials
 * - Verifiers can resolve the DID to check developer identity
 *
 * For now, this placeholder allows local testing and development.
 */
export const PLACEHOLDER_ISSUER_DID = 'did:beltic:wizard:self-signed';

/**
 * Generate a placeholder subject DID for the agent.
 * Uses the agent name to create a unique identifier.
 */
export function generatePlaceholderSubjectDid(agentName: string): string {
  // Normalize agent name to be DID-safe
  const safeName = agentName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `did:beltic:agent:${safeName}`;
}

// Default patterns for gitignore
export const GITIGNORE_ENTRIES = [
  '# Beltic - Private keys and credentials',
  '.beltic/',
  '*-private.pem',
  '*.private.pem',
];

// Default exclude patterns for fingerprinting
export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/*.test.*',
  '**/*.spec.*',
  '**/test/**',
  '**/tests/**',
  '**/node_modules/**',
  '**/target/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/*.log',
  '**/.env*',
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
  '**/.mypy_cache/**',
  '**/.pytest_cache/**',
];

// Common include patterns by language
export const INCLUDE_PATTERNS_BY_LANGUAGE: Record<string, string[]> = {
  typescript: ['src/**/*.ts', 'src/**/*.tsx', 'package.json', 'README.md'],
  javascript: ['src/**/*.js', 'src/**/*.jsx', 'package.json', 'README.md'],
  python: ['src/**/*.py', '**/*.py', 'pyproject.toml', 'setup.py', 'README.md'],
  other: ['src/**', 'README.md'],
};
