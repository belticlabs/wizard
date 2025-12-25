# Beltic Wizard

> **Note:** This is a heavily modified fork of the [PostHog Wizard](https://github.com/PostHog/wizard), optimized specifically for Beltic and Beltic CLI usage. While it shares some architectural patterns with the original PostHog wizard, it has been significantly refactored and customized for Beltic's credential management workflow.

The Beltic wizard automatically analyzes AI agent codebases and generates credentials, manifests, and signatures using the [Beltic CLI](https://github.com/belticlabs/beltic-cli).

## What it does

When you run the wizard in an agent codebase, it will:

1. **Check/Install Beltic CLI** - Ensures the Beltic CLI is installed (via Homebrew or curl)
2. **Analyze Codebase** - Uses AI to detect language, deployment type, model provider, and structure
3. **Generate Configuration** - Creates `.beltic.yaml` with appropriate file patterns
4. **Create Manifest** - Runs `beltic init` to generate `agent-manifest.json`
5. **Generate Fingerprint** - Runs `beltic fingerprint` to create a deterministic hash of your code
6. **Create Keys & Sign** - Generates Ed25519 keypair and signs the credential
7. **Update Files** - Adds Beltic entries to `.gitignore` and documents in `README.md`

## Usage

```bash
# Run in your agent's directory
# First run will prompt you to authenticate via browser
npx @belticlabs/wizard

# Or with explicit Anthropic API key (optional)
npx @belticlabs/wizard --anthropic-key YOUR_API_KEY

# Run in a specific directory
npx @belticlabs/wizard --install-dir /path/to/agent
```

### Authentication

On first run, the wizard will prompt you to authenticate with Beltic via browser OAuth. Your credentials are stored securely in `~/.beltic/credentials.json`. Subsequent runs will automatically use your stored credentials.

See [AUTHENTICATION.md](./AUTHENTICATION.md) for detailed authentication flow documentation.

## Requirements

- **Node.js** >= 18.17.0
- **Anthropic API Key** - Optional. Default API key is provided (Beltic covers costs). Override with `ANTHROPIC_API_KEY` environment variable or `--anthropic-key` flag

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--anthropic-key` | Anthropic API key for LLM analysis (optional - default key provided) | `ANTHROPIC_API_KEY` env var or default |
| `--install-dir` | Directory containing the agent codebase | Current directory |
| `--skip-sign` | Skip signing (only generate manifest) | `false` |
| `--skip-readme` | Skip updating README.md | `false` |
| `--force` | Overwrite existing Beltic files | `false` |
| `--debug` | Enable verbose logging | `false` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for codebase analysis |
| `BELTIC_WIZARD_DEBUG` | Enable debug mode (`true`/`false`) |
| `BELTIC_WIZARD_INSTALL_DIR` | Default installation directory |

## Generated Files

After running the wizard, your project will have:

```
your-agent/
├── .beltic.yaml           # Configuration for fingerprinting
├── agent-manifest.json    # Agent metadata and capabilities
├── agent-credential.jwt   # Signed credential (JWT format)
├── .beltic/               # Cryptographic keys
│   ├── eddsa-*-private.pem  # Private key (gitignored)
│   └── eddsa-*-public.pem   # Public key
└── .gitignore             # Updated with Beltic entries
```

## After Setup

### Verify Credential

```bash
beltic verify --key .beltic/*-public.pem --token agent-credential.jwt
```

### Re-sign After Code Changes

```bash
# Update the fingerprint
beltic fingerprint

# Re-sign the credential
beltic sign
```

### View Credential Contents

```bash
# Decode and view the JWT payload
beltic verify --key .beltic/*-public.pem --token agent-credential.jwt
```

## Development

### Building

```bash
pnpm install
pnpm build
```

### Running Locally

```bash
# Build and run
pnpm try --install-dir /path/to/agent

# Or with hot reload
pnpm dev
```

### Testing

```bash
pnpm test
```

## How It Works

The wizard uses Claude to analyze your codebase:

1. **Detection Phase** - Examines file structure, `package.json`/`pyproject.toml`, and dependencies to determine language, deployment type, and AI model provider
2. **Configuration Generation** - Uses LLM to generate optimal `.beltic.yaml` patterns based on project structure
3. **CLI Orchestration** - Runs Beltic CLI commands in sequence to create and sign credentials

All file modifications are limited to Beltic-specific files. The wizard **never modifies your agent's source code**.

## Supported Languages

- TypeScript/JavaScript (Node.js)
- Python

## Supported Deployment Types

- Standalone
- Monorepo
- Embedded
- Plugin
- Serverless

## Related Projects

- [beltic-cli](https://github.com/belticlabs/beltic-cli) - CLI for signing and verifying credentials
- [beltic-spec](https://github.com/belticlabs/beltic-spec) - JSON schemas for agent/developer credentials
- [@belticlabs/kya](https://github.com/belticlabs/beltic-sdk) - TypeScript SDK for credential verification

## License

MIT
