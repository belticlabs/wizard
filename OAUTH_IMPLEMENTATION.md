# OAuth Implementation for Beltic Wizard

This document describes the OAuth implementation extracted from the PostHog wizard and adapted for Beltic/KYA platform use.

## Overview

The OAuth implementation provides a generic OAuth 2.0 Authorization Code flow with PKCE (Proof Key for Code Exchange) that works with:
- **WorkOS** (recommended for KYA platform)
- **Any OAuth 2.0 provider** that supports PKCE
- **KYA Platform** (custom OAuth endpoints)

## Files Added

### Core OAuth Implementation

1. **`src/utils/oauth.ts`** - Generic OAuth 2.0 PKCE flow
   - `performOAuthFlow()` - Main OAuth function
   - PKCE code generation and verification
   - Local callback server for OAuth redirects
   - Cross-platform URL opening

2. **`src/lib/api.ts`** - API client for KYA platform
   - `apiRequest()` - Generic API request function
   - `fetchDeveloperData()` - Get current developer
   - `fetchAgentData()` - Get agent by ID
   - `listAgents()` - List developer's agents
   - Error handling with `ApiError` class

### Platform-Specific Helpers

3. **`src/lib/workos-oauth.ts`** - WorkOS OAuth helper
   - `performWorkOSOAuth()` - Convenience wrapper for WorkOS
   - Pre-configured WorkOS endpoints

4. **`src/lib/kya-oauth.ts`** - KYA platform OAuth helper
   - `performKyaOAuth()` - Convenience wrapper for KYA
   - Pre-configured KYA endpoints

5. **`src/lib/oauth-example.ts`** - Usage examples
   - Examples for WorkOS, KYA, and custom providers

### Configuration

6. **`src/lib/constants.ts`** - Updated with OAuth constants
   - `OAUTH_PORT` - Local callback server port (8239)
   - `KYA_API_URL` - KYA platform API URL
   - `KYA_AUTH_URL` - KYA platform auth URL
   - `KYA_CLIENT_ID` - KYA OAuth client ID
   - `WORKOS_CLIENT_ID` - WorkOS client ID

## Usage

### Basic OAuth Flow (WorkOS)

```typescript
import { performWorkOSOAuth } from './lib/workos-oauth';

// Authenticate with WorkOS
const tokenResponse = await performWorkOSOAuth({
  signup: false, // Set to true for signup flow
});

console.log('Access token:', tokenResponse.access_token);
```

### KYA Platform OAuth

```typescript
import { performKyaOAuth } from './lib/kya-oauth';
import { fetchDeveloperData } from './lib/api';
import { KYA_API_URL } from './lib/constants';

// Authenticate with KYA platform
const tokenResponse = await performKyaOAuth({
  scopes: ['read:developer', 'write:agent'],
});

// Use token to fetch developer data
const developer = await fetchDeveloperData(
  tokenResponse.access_token,
  KYA_API_URL
);
```

### Custom OAuth Provider

```typescript
import { performOAuthFlow } from './utils/oauth';

const tokenResponse = await performOAuthFlow({
  authUrl: 'https://your-provider.com/oauth/authorize',
  tokenUrl: 'https://your-provider.com/oauth/token',
  clientId: 'your-client-id',
  scopes: ['read', 'write'],
  appName: 'Your App Name',
});
```

## Environment Variables

Set these environment variables for OAuth configuration:

```bash
# KYA Platform
KYA_API_URL=https://api.beltic.app
KYA_AUTH_URL=https://auth.beltic.app
KYA_CLIENT_ID=your-kya-client-id

# WorkOS (alternative)
WORKOS_CLIENT_ID=your-workos-client-id
WORKOS_API_KEY=your-workos-api-key
```

## How It Works

1. **PKCE Flow**: Generates a code verifier and challenge for secure OAuth
2. **Local Server**: Starts a local HTTP server on port 8239 to receive the OAuth callback
3. **Browser Redirect**: Opens the user's browser to the OAuth authorization URL
4. **Token Exchange**: Exchanges the authorization code for an access token
5. **API Access**: Uses the access token to make authenticated API calls

## Integration with KYA Platform

The OAuth implementation is designed to work seamlessly with the KYA platform:

1. **WorkOS Integration**: KYA platform uses WorkOS for authentication
2. **Token Usage**: Access tokens can be used with the KYA API client (`src/lib/api.ts`)
3. **Developer Context**: After OAuth, you can fetch developer data and manage agents

## Differences from PostHog Implementation

- **Removed PostHog-specific code**: No PostHog API endpoints or schemas
- **Generic OAuth**: Works with any OAuth 2.0 provider
- **KYA Platform Support**: Added helpers for KYA platform integration
- **WorkOS Support**: Added helpers for WorkOS (which KYA uses)
- **Cross-platform URL opening**: Uses Node.js child_process instead of `opn` package

## Next Steps

1. **Configure OAuth Provider**: Set up WorkOS or KYA platform OAuth app
2. **Set Environment Variables**: Configure client IDs and URLs
3. **Integrate into Wizard**: Add OAuth flow to wizard's main flow
4. **Test**: Test OAuth flow with your provider

## Security Notes

- **PKCE**: Uses PKCE for secure OAuth flows (required for public clients)
- **Local Server**: Uses localhost callback (secure, no external exposure)
- **Token Storage**: Access tokens should be stored securely (not in code)
- **HTTPS**: Always use HTTPS for OAuth endpoints in production

