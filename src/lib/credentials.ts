/**
 * Credential Storage Module
 *
 * Handles secure storage of OAuth credentials in ~/.beltic/credentials.json
 * Credentials are stored with mode 0600 (owner read/write only).
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { BELTIC_CONFIG_DIR, CREDENTIALS_FILE } from './constants';
import { debug } from '../utils/debug';

/**
 * Schema for stored credentials
 */
export const StoredCredentialsSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  developerId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  expiresAt: z.number().optional(), // Unix timestamp in milliseconds
});

export type StoredCredentials = z.infer<typeof StoredCredentialsSchema>;

/**
 * Ensure the ~/.beltic directory exists with secure permissions
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(BELTIC_CONFIG_DIR)) {
    fs.mkdirSync(BELTIC_CONFIG_DIR, { recursive: true, mode: 0o700 });
    debug(`Created config directory: ${BELTIC_CONFIG_DIR}`);
  }
}

/**
 * Save credentials to ~/.beltic/credentials.json
 * File is created with mode 0600 (owner read/write only)
 */
export function saveCredentials(credentials: StoredCredentials): void {
  ensureConfigDir();

  const data = JSON.stringify(credentials, null, 2);

  // Write with secure permissions (0600 = owner read/write only)
  fs.writeFileSync(CREDENTIALS_FILE, data, { mode: 0o600 });
  debug(`Saved credentials to: ${CREDENTIALS_FILE}`);
}

/**
 * Load credentials from ~/.beltic/credentials.json
 * Returns null if file doesn't exist or is invalid
 */
export function loadCredentials(): StoredCredentials | null {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    debug('No credentials file found');
    return null;
  }

  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const credentials = StoredCredentialsSchema.parse(parsed);
    debug(`Loaded credentials for: ${credentials.email}`);
    return credentials;
  } catch (error) {
    debug('Failed to load credentials:', error);
    return null;
  }
}

/**
 * Clear stored credentials by deleting the credentials file
 */
export function clearCredentials(): void {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
    debug('Cleared credentials');
  }
}

/**
 * Check if valid (non-expired) credentials exist
 */
export function hasValidCredentials(): boolean {
  const credentials = loadCredentials();
  if (!credentials) {
    return false;
  }

  // If no expiry is set, assume credentials are valid
  if (!credentials.expiresAt) {
    return true;
  }

  // Check if token has expired (with 5 minute buffer)
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  const isExpired = Date.now() >= credentials.expiresAt - bufferMs;

  if (isExpired) {
    debug('Credentials have expired');
  }

  return !isExpired;
}

/**
 * Get the path to the credentials file
 */
export function getCredentialsPath(): string {
  return CREDENTIALS_FILE;
}
