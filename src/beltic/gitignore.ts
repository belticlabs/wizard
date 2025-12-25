/**
 * Gitignore helper for adding Beltic-specific entries
 */

import * as fs from 'fs';
import * as path from 'path';
import { GITIGNORE_ENTRIES } from '../lib/constants';

/**
 * Update .gitignore with Beltic entries
 * Returns true if changes were made
 */
export function updateGitignore(installDir: string): boolean {
  const gitignorePath = path.join(installDir, '.gitignore');
  
  let existingContent = '';
  if (fs.existsSync(gitignorePath)) {
    existingContent = fs.readFileSync(gitignorePath, 'utf-8');
  }

  const linesToAdd: string[] = [];
  const existingLines = existingContent.split('\n').map((l) => l.trim());

  for (const entry of GITIGNORE_ENTRIES) {
    // Skip comments, we'll add them as a block
    if (entry.startsWith('#')) {
      continue;
    }

    // Check if entry already exists
    if (!existingLines.includes(entry.trim())) {
      linesToAdd.push(entry);
    }
  }

  if (linesToAdd.length === 0) {
    return false;
  }

  // Build the block to add
  const blockToAdd = [
    '',
    '# Beltic - Private keys and credentials',
    ...linesToAdd,
  ].join('\n');

  // Ensure file ends with newline before adding
  let newContent = existingContent;
  if (newContent && !newContent.endsWith('\n')) {
    newContent += '\n';
  }
  newContent += blockToAdd + '\n';

  fs.writeFileSync(gitignorePath, newContent, 'utf-8');
  return true;
}

/**
 * Check if .gitignore already has Beltic entries
 */
export function hasBelticEntries(installDir: string): boolean {
  const gitignorePath = path.join(installDir, '.gitignore');
  
  if (!fs.existsSync(gitignorePath)) {
    return false;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');
  return content.includes('.beltic/') || content.includes('# Beltic');
}

/**
 * Check if .gitignore exists
 */
export function gitignoreExists(installDir: string): boolean {
  return fs.existsSync(path.join(installDir, '.gitignore'));
}
