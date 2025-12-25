/**
 * README helper for adding Beltic section
 */

import * as fs from 'fs';
import * as path from 'path';

const BELTIC_SECTION_MARKER = '<!-- BELTIC_CREDENTIALS -->';

/**
 * Generate Beltic section content for README
 */
export function generateBelticSection(agentName: string): string {
  return `
${BELTIC_SECTION_MARKER}
## Agent Credentials

This agent is signed and verified using [Beltic](https://github.com/belticlabs/beltic-spec).

### Files

- \`.beltic.yaml\` - Configuration for code fingerprinting
- \`agent-manifest.json\` - Agent manifest with metadata and capabilities
- \`agent-credential.jwt\` - Signed credential (JWT format)
- \`.beltic/\` - Cryptographic keys (private keys are gitignored)

### Verification

To verify this agent's credential:

\`\`\`bash
# Install Beltic CLI (if not already installed)
brew tap belticlabs/tap && brew install beltic

# Verify the credential
beltic verify --key .beltic/*-public.pem --token agent-credential.jwt
\`\`\`

### Regenerating Credentials

To regenerate credentials after code changes:

\`\`\`bash
# Update fingerprint
beltic fingerprint

# Re-sign the credential
beltic sign
\`\`\`
${BELTIC_SECTION_MARKER}
`;
}

/**
 * Update README with Beltic section
 * Returns true if changes were made
 */
export function updateReadme(installDir: string, agentName: string): boolean {
  const readmePath = findReadme(installDir);
  
  if (!readmePath) {
    // Create a new README if none exists
    const newContent = `# ${agentName}

${generateBelticSection(agentName)}
`;
    fs.writeFileSync(path.join(installDir, 'README.md'), newContent, 'utf-8');
    return true;
  }

  let content = fs.readFileSync(readmePath, 'utf-8');

  // Check if Beltic section already exists
  if (content.includes(BELTIC_SECTION_MARKER)) {
    // Replace existing section
    const sectionRegex = new RegExp(
      `${escapeRegExp(BELTIC_SECTION_MARKER)}[\\s\\S]*?${escapeRegExp(BELTIC_SECTION_MARKER)}`,
      'g',
    );
    content = content.replace(sectionRegex, generateBelticSection(agentName).trim());
  } else {
    // Add new section at the end
    if (!content.endsWith('\n')) {
      content += '\n';
    }
    content += generateBelticSection(agentName);
  }

  fs.writeFileSync(readmePath, content, 'utf-8');
  return true;
}

/**
 * Find README file in directory
 */
export function findReadme(installDir: string): string | null {
  const readmeNames = [
    'README.md',
    'readme.md',
    'Readme.md',
    'README.MD',
    'README',
    'readme',
  ];

  for (const name of readmeNames) {
    const fullPath = path.join(installDir, name);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Check if README has Beltic section
 */
export function hasBelticSection(installDir: string): boolean {
  const readmePath = findReadme(installDir);
  if (!readmePath) {
    return false;
  }

  const content = fs.readFileSync(readmePath, 'utf-8');
  return content.includes(BELTIC_SECTION_MARKER) || content.includes('## Agent Credentials');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
