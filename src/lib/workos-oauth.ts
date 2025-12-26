import {
  performOAuthFlow,
  type OAuthConfig,
  type OAuthTokenResponse,
} from '../utils/oauth';
import { WORKOS_CLIENT_ID, KYA_API_URL } from './constants';

/**
 * WorkOS AuthKit OAuth Configuration Helper
 *
 * WorkOS AuthKit uses OAuth 2.0 with PKCE for user management.
 * This is designed for public clients (CLI tools, mobile apps) where
 * secrets cannot be kept confidential.
 *
 * AuthKit User Management endpoints:
 * - Authorization: https://api.workos.com/user_management/authorize
 * - Token: https://api.workos.com/user_management/token
 */

export interface WorkOSOAuthConfig {
  /** WorkOS client ID (defaults to hardcoded WORKOS_CLIENT_ID) */
  clientId?: string;
  /** WorkOS authorization URL (defaults to AuthKit endpoint) */
  authUrl?: string;
  /** WorkOS token URL (defaults to AuthKit endpoint) */
  tokenUrl?: string;
  /** Scopes to request (defaults to OpenID Connect scopes) */
  scopes?: string[];
  /** Signup URL for new users */
  signupUrl?: string;
  /** Whether this is a signup flow */
  signup?: boolean;
}

/**
 * Get WorkOS AuthKit OAuth configuration
 *
 * Uses WorkOS User Management (AuthKit) endpoints for authentication.
 * These are different from the SSO endpoints - AuthKit is for direct
 * user authentication, while SSO is for enterprise connections.
 */
function getWorkOSOAuthConfig(config: WorkOSOAuthConfig = {}): OAuthConfig {
  const clientId = config.clientId || WORKOS_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      'WorkOS client ID is required. The default should be hardcoded in constants.ts.',
    );
  }

  // WorkOS AuthKit (User Management) endpoints
  const authUrl =
    config.authUrl || 'https://api.workos.com/user_management/authorize';
  const tokenUrl =
    config.tokenUrl || 'https://api.workos.com/user_management/token';

  // OpenID Connect scopes for AuthKit
  const scopes = config.scopes || ['openid', 'email', 'profile'];

  return {
    authUrl,
    tokenUrl,
    clientId,
    scopes,
    signupUrl: config.signupUrl,
    appName: 'Beltic',
  };
}

/**
 * Perform WorkOS OAuth flow
 *
 * This is a convenience wrapper around performOAuthFlow that
 * configures it specifically for WorkOS.
 *
 * @deprecated Use performBelticOAuth instead to match beltic-cli's flow
 */
export async function performWorkOSOAuth(
  config: WorkOSOAuthConfig = {},
): Promise<OAuthTokenResponse> {
  const oauthConfig = getWorkOSOAuthConfig(config);
  return performOAuthFlow(oauthConfig);
}

/**
 * Perform Beltic OAuth flow matching beltic-cli's implementation
 *
 * This function:
 * - Uses WorkOS authorize endpoint with provider=authkit
 * - Exchanges code via console endpoint POST {BELTIC_CONSOLE_URL}/api/auth/token
 * - Includes state parameter for security
 * - Uses WORKOS_CLIENT_ID from constants
 *
 * @param config Optional configuration (uses defaults matching beltic-cli)
 * @returns OAuth token response with access token
 */
export async function performBelticOAuth(
  config: WorkOSOAuthConfig = {},
): Promise<OAuthTokenResponse> {
  const clientId = config.clientId || WORKOS_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      'WorkOS client ID is required. The default should be hardcoded in constants.ts.',
    );
  }

  // Use WorkOS authorize endpoint with provider=authkit (matching beltic-cli)
  // Note: provider=authkit will be added as a query parameter in performOAuthFlow
  // We need to ensure it's included in the base URL or add it as a query param
  let authUrl =
    config.authUrl || 'https://api.workos.com/user_management/authorize';

  // Ensure provider=authkit is included (performOAuthFlow will add it as a query param)
  // Actually, we'll add it here to the base URL so it's included
  const authUrlObj = new URL(authUrl);
  authUrlObj.searchParams.set('provider', 'authkit');
  authUrl = authUrlObj.toString();

  // Token exchange goes through console endpoint (matching beltic-cli)
  const consoleUrl = KYA_API_URL.trim().replace(/\/$/, ''); // Remove trailing slash
  const tokenUrl = `${consoleUrl}/api/auth/token`;

  // OpenID Connect scopes for AuthKit
  const scopes = config.scopes || ['openid', 'email', 'profile'];

  const oauthConfig: OAuthConfig = {
    authUrl,
    tokenUrl,
    clientId,
    scopes,
    signupUrl: config.signupUrl,
    appName: 'Beltic',
  };

  return performOAuthFlow(oauthConfig);
}
