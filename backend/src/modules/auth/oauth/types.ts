import type { AuthProvider } from "@prisma/client";

// Normalized identity + token bundle returned by every OAuth provider adapter.
export interface OAuthProfile {
  provider: AuthProvider; // GOOGLE | GITHUB
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  username: string; // preferred handle seed
  avatar: string | null;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  // Absolute expiry of the provider access token, if known.
  expiresAt: Date | null;
}
