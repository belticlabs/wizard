/**
 * Schema fetcher for Beltic credential schemas
 * Fetches and caches schemas from beltic-spec GitHub repository
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import {
  AGENT_CREDENTIAL_SCHEMA_URL,
  DEVELOPER_CREDENTIAL_SCHEMA_URL,
} from '../lib/constants';
import { debug } from '../utils/debug';

const CACHE_DIR = path.join(os.homedir(), '.beltic', 'schemas');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type SchemaType = 'agent' | 'developer';

interface CacheEntry {
  schema: object;
  fetchedAt: number;
}

/**
 * Get schema URL by type
 */
function getSchemaUrl(type: SchemaType): string {
  switch (type) {
    case 'agent':
      return AGENT_CREDENTIAL_SCHEMA_URL;
    case 'developer':
      return DEVELOPER_CREDENTIAL_SCHEMA_URL;
    default:
      throw new Error(`Unknown schema type: ${type}`);
  }
}

/**
 * Get cache file path
 */
function getCacheFilePath(type: SchemaType): string {
  return path.join(CACHE_DIR, `${type}-credential.schema.json`);
}

/**
 * Get cache metadata file path
 */
function getCacheMetaPath(type: SchemaType): string {
  return path.join(CACHE_DIR, `${type}-credential.meta.json`);
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Check if cache is valid
 */
function isCacheValid(type: SchemaType): boolean {
  const metaPath = getCacheMetaPath(type);
  const schemaPath = getCacheFilePath(type);

  if (!fs.existsSync(metaPath) || !fs.existsSync(schemaPath)) {
    return false;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as CacheEntry;
    const age = Date.now() - meta.fetchedAt;
    return age < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Read schema from cache
 */
function readFromCache(type: SchemaType): object | null {
  if (!isCacheValid(type)) {
    return null;
  }

  try {
    const schemaPath = getCacheFilePath(type);
    return JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Write schema to cache
 */
function writeToCache(type: SchemaType, schema: object): void {
  ensureCacheDir();

  const schemaPath = getCacheFilePath(type);
  const metaPath = getCacheMetaPath(type);

  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');
  fs.writeFileSync(
    metaPath,
    JSON.stringify({ fetchedAt: Date.now() }, null, 2),
    'utf-8',
  );
}

/**
 * Fetch schema from GitHub
 */
async function fetchSchemaFromGitHub(type: SchemaType): Promise<object> {
  const url = getSchemaUrl(type);
  debug(`Fetching schema from: ${url}`);

  const response = await axios.get(url, {
    timeout: 10000,
    headers: {
      Accept: 'application/json',
    },
  });

  return response.data;
}

/**
 * Get schema (from cache or fetch from GitHub)
 */
export async function getSchema(type: SchemaType): Promise<object> {
  // Try cache first
  const cached = readFromCache(type);
  if (cached) {
    debug(`Using cached schema for ${type}`);
    return cached;
  }

  // Fetch from GitHub
  debug(`Fetching schema for ${type} from GitHub`);
  const schema = await fetchSchemaFromGitHub(type);

  // Cache for future use
  writeToCache(type, schema);

  return schema;
}

/**
 * Get agent credential schema
 */
export async function getAgentCredentialSchema(): Promise<object> {
  return getSchema('agent');
}

/**
 * Get developer credential schema
 */
export async function getDeveloperCredentialSchema(): Promise<object> {
  return getSchema('developer');
}

/**
 * Clear schema cache
 */
export function clearSchemaCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Validate JSON against schema (basic validation)
 * For full validation, use the beltic CLI
 */
export function validateBasicStructure(
  data: object,
  type: SchemaType,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (type === 'agent') {
    // Basic agent credential structure validation
    const required = ['@context', 'type', 'id', 'issuer', 'credentialSubject'];
    for (const field of required) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (type === 'developer') {
    // Basic developer credential structure validation
    const required = ['@context', 'type', 'id', 'issuer', 'credentialSubject'];
    for (const field of required) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
