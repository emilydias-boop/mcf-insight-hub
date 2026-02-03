/**
 * JWT Token Utilities
 * 
 * Utilities for decoding JWT tokens and extracting user roles.
 * Used by AuthContext to read roles directly from the access token,
 * eliminating the need for additional database queries.
 */

export interface JWTPayload {
  user_roles?: string[];
  sub?: string;
  exp?: number;
  iat?: number;
  email?: string;
  role?: string;
  aud?: string;
  [key: string]: unknown;
}

/**
 * Decodes the payload portion of a JWT token
 * @param token - The JWT access token string
 * @returns The decoded payload or null if decoding fails
 */
export const decodeJWTPayload = (token: string): JWTPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[JWT] Invalid token format: expected 3 parts');
      return null;
    }
    
    const payload = parts[1];
    // Handle URL-safe base64 encoding
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[JWT] Failed to decode token:', error);
    return null;
  }
};

/**
 * Extracts user roles from a JWT access token
 * @param accessToken - The JWT access token string
 * @returns Array of role strings, empty array if no roles found
 */
export const getRolesFromToken = (accessToken: string | undefined): string[] => {
  if (!accessToken) {
    console.log('[JWT] No access token provided');
    return [];
  }
  
  const payload = decodeJWTPayload(accessToken);
  const roles = payload?.user_roles || [];
  
  console.log('[JWT] Extracted roles from token:', roles);
  return roles;
};

/**
 * Checks if a JWT token has expired
 * @param accessToken - The JWT access token string
 * @returns true if expired or invalid, false if still valid
 */
export const isTokenExpired = (accessToken: string | undefined): boolean => {
  if (!accessToken) return true;
  
  const payload = decodeJWTPayload(accessToken);
  if (!payload?.exp) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = payload.exp * 1000;
  return Date.now() >= expirationTime;
};
