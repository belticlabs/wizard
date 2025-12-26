/**
 * OAuth Usage Examples
 *
 * This file demonstrates how to use the OAuth utilities
 * with WorkOS or the KYA platform.
 *
 * NOTE: This is an example file - not meant to be imported directly.
 * Copy the patterns you need into your actual implementation.
 */

import { performWorkOSOAuth } from './workos-oauth';
import { performKyaOAuth } from './kya-oauth';
import { fetchDeveloperData, listAgents } from './api';
import { KYA_API_URL } from './constants';

/**
 * Example: Authenticate with WorkOS and fetch user data
 */
export async function exampleWorkOSAuth() {
  try {
    // Perform OAuth flow with WorkOS
    const tokenResponse = await performWorkOSOAuth({
      signup: false, // Set to true for signup flow
    });

    // eslint-disable-next-line no-console
    console.log('Access token:', tokenResponse.access_token);

    // Use the access token to make API calls
    // Note: WorkOS tokens may need to be exchanged for KYA platform tokens
    // depending on your architecture

    return tokenResponse;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('OAuth failed:', error);
    throw error;
  }
}

/**
 * Example: Authenticate with KYA platform and fetch developer data
 */
export async function exampleKyaAuth() {
  try {
    // Perform OAuth flow with KYA platform
    const tokenResponse = await performKyaOAuth({
      signup: false,
      scopes: ['read:developer', 'write:agent', 'read:credentials'],
    });

    const accessToken = tokenResponse.access_token;

    // Fetch current developer data
    const developer = await fetchDeveloperData(accessToken, KYA_API_URL);
    // eslint-disable-next-line no-console
    console.log('Developer:', developer);

    // List developer's agents
    const agents = await listAgents(accessToken, KYA_API_URL, developer.id);
    // eslint-disable-next-line no-console
    console.log('Agents:', agents);

    return { developer, agents, token: accessToken };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('KYA OAuth failed:', error);
    throw error;
  }
}

/**
 * Example: Custom OAuth provider
 *
 * If you're using a different OAuth provider, you can use
 * performOAuthFlow directly with a custom configuration.
 */
export async function exampleCustomOAuth() {
  // Using static import from top of file instead of dynamic import
  // Dynamic imports with relative paths require .js extensions in node16 resolution
  const { performOAuthFlow } = await import('../utils/oauth.js');

  const tokenResponse = await performOAuthFlow({
    authUrl: 'https://your-auth-provider.com/oauth/authorize',
    tokenUrl: 'https://your-auth-provider.com/oauth/token',
    clientId: 'your-client-id',
    scopes: ['read', 'write'],
    appName: 'Your App',
  });

  return tokenResponse;
}
