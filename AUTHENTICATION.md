# Authentication Flow

This document describes how the Beltic wizard handles user authentication.

## Overview

The wizard uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) to authenticate users with the Beltic platform via WorkOS AuthKit. Credentials are stored securely in `~/.beltic/credentials.json`.

## Authentication Behavior

### First Run (No Credentials)

When you run the wizard for the first time:

1. **Prompt**: The wizard asks `Login to Beltic to continue?` (default: Yes)
2. **Browser Opens**: If you confirm, your browser opens to the WorkOS login page
3. **OAuth Flow**: You authenticate with WorkOS (supports Google, GitHub, email/password, etc.)
4. **Callback**: After successful authentication, the browser redirects back to the wizard
5. **Token Exchange**: The wizard exchanges the authorization code for an access token via the Beltic console API
6. **Profile Fetch**: The wizard fetches your developer profile from `/api/developers/me`
7. **Storage**: Credentials are saved to `~/.beltic/credentials.json` with secure permissions (0600)

### Subsequent Runs (Valid Credentials)

If you have valid credentials stored:

1. **Auto-Login**: The wizard automatically detects and uses your stored credentials
2. **No Prompt**: No authentication prompt or browser opening
3. **Welcome Message**: Shows `Logged in as {email}`

### Expired Credentials

If your stored credentials have expired:

1. **Warning**: Shows `Your session has expired. Please log in again.`
2. **Prompt**: Asks `Login to Beltic to continue?` (default: Yes)
3. **Re-authentication**: Follows the same flow as first run

## Technical Details

### OAuth Flow

The wizard implements OAuth 2.0 Authorization Code flow with PKCE:

1. **Authorization URL**: `https://api.workos.com/user_management/authorize`
   - Includes `provider=authkit` parameter
   - Uses PKCE with SHA256 code challenge
   - Includes random state parameter for CSRF protection
   - Redirects to `http://localhost:8239/callback`

2. **Token Exchange**: `POST {BELTIC_CONSOLE_URL}/api/auth/token`
   - Uses JSON body: `{ code, code_verifier, redirect_uri, client_id }`
   - Returns access token and optional refresh token

3. **State Validation**: 
   - Random state is generated for each flow
   - State is validated on callback to prevent CSRF attacks
   - Mismatched state results in authentication failure

### Security Features

- **PKCE**: Prevents authorization code interception attacks
- **State Parameter**: Protects against CSRF attacks
- **Localhost Binding**: Callback server binds to `127.0.0.1` only (not `0.0.0.0`)
- **Secure Storage**: Credentials file has mode 0600 (owner read/write only)
- **Token Validation**: Access token is validated by calling `/api/developers/me`

### Timeout

- **Authorization Timeout**: 5 minutes (300 seconds)
- Matches beltic-cli's timeout for consistency

### Credential Storage

Credentials are stored in `~/.beltic/credentials.json`:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "developerId": "...",
  "email": "...",
  "name": "...",
  "expiresAt": 1234567890000
}
```

The file is created with permissions `0600` (owner read/write only).

## Error Handling

### Port Already in Use

If port 8239 is already in use:
- Clear error message: `Port 8239 is already in use. Please close the application using this port and try again.`

### State Mismatch

If the OAuth callback state doesn't match:
- Authentication fails with error: `State mismatch: OAuth callback state does not match expected value`
- This indicates a potential security issue

### Access Denied

If user cancels authentication:
- Shows: `Authorization was cancelled.`
- Provides instructions to try again

### Token Validation Failure

If token validation fails (401/403):
- Error: `Token validation failed. Your account may not be linked to the platform.`
- User needs to ensure their WorkOS account is properly linked

## Environment Variables

The following environment variables can override defaults:

- `KYA_API_URL`: Override console URL (default: `https://console.beltic.app`)
- `WORKOS_CLIENT_ID`: Override WorkOS client ID (not recommended)

## Implementation Files

- `src/utils/oauth.ts`: Core OAuth flow implementation
- `src/lib/workos-oauth.ts`: Beltic-specific OAuth wrapper (`performBelticOAuth`)
- `src/lib/credentials.ts`: Credential storage and validation
- `src/run.ts`: Authentication orchestration (`authenticateWithKya`)

