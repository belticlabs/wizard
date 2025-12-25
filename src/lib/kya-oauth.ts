import { performOAuthFlow, type OAuthConfig, type OAuthTokenResponse } from '../utils/oauth';
import { KYA_AUTH_URL, KYA_CLIENT_ID, KYA_API_URL } from './constants';

/**
 * KYA Platform OAuth Configuration Helper
 * 
 * This helper configures OAuth for the KYA (Know Your Agent) platform.
 * The KYA platform can use WorkOS or any OAuth 2.0 provider.
 */

export interface KyaOAuthConfig {
  /** KYA client ID (defaults to KYA_CLIENT_ID env var) */
  clientId?: string;
  /** KYA authorization URL (defaults to KYA_AUTH_URL env var) */
  authUrl?: string;
  /** KYA token URL */
  tokenUrl?: string;
  /** Scopes to request */
  scopes?: string[];
  /** Signup URL for new users */
  signupUrl?: string;
  /** Whether this is a signup flow */
  signup?: boolean;
}

/**
 * Get KYA OAuth configuration
 * 
 * KYA platform OAuth endpoints are typically:
 * - Authorization: {KYA_AUTH_URL}/oauth/authorize
 * - Token: {KYA_AUTH_URL}/oauth/token
 */
function getKyaOAuthConfig(config: KyaOAuthConfig = {}): OAuthConfig {
  const clientId = config.clientId || KYA_CLIENT_ID;
  
  if (!clientId) {
    throw new Error(
      'KYA client ID is required. Set KYA_CLIENT_ID environment variable.',
    );
  }

  const baseAuthUrl = config.authUrl || KYA_AUTH_URL;
  const authUrl = `${baseAuthUrl}/oauth/authorize`;
  const tokenUrl = config.tokenUrl || `${baseAuthUrl}/oauth/token`;

  // Default scopes for KYA platform
  const scopes = config.scopes || ['read:developer', 'write:agent'];

  const signupUrl = config.signupUrl || `${baseAuthUrl}/signup`;

  return {
    authUrl,
    tokenUrl,
    clientId,
    scopes,
    signupUrl,
    appName: 'Beltic KYA',
  };
}

/**
 * Perform KYA platform OAuth flow
 * 
 * This is a convenience wrapper around performOAuthFlow that
 * configures it specifically for the KYA platform.
 */
export async function performKyaOAuth(
  config: KyaOAuthConfig = {},
): Promise<OAuthTokenResponse> {
  const oauthConfig = getKyaOAuthConfig(config);
  return performOAuthFlow(oauthConfig);
}

