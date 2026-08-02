import type { User } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { encryptNullable } from "../../lib/crypto.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors.js";
import { generateUniqueUsername } from "./user.helpers.js";
import type { RegisterInput } from "./auth.schema.js";
import type { OAuthProfile } from "./oauth/types.js";

// ---------------- Local (email + password) ----------------
export async function registerLocal(input: RegisterInput): Promise<User> {
  const email = input.email.toLowerCase();

  // check for exisitng user with the same email
  const existing = await prisma.authAccount.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const usernameSeed =
    input.username ?? input.displayName ?? email.split("@")[0]!;

  return prisma.$transaction(async (tx) => {
    const username = input.username
      ? input.username
      : await generateUniqueUsername(usernameSeed, tx);

    // If an explicit username was requested, enforce uniqueness up-front for a
    // clean error (the unique constraint is the ultimate guard).
    if (input.username) {
      const taken = await tx.user.findUnique({ where: { username } });
      if (taken) throw new ConflictError("Username is already taken");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await tx.user.create({
      data: {
        username,
        displayName: input.displayName ?? username,
        accounts: {
          create: {
            provider: "LOCAL",
            providerUserId: email,
            email,
            emailVerified: false,
            passwordHash,
          },
        },
      },
    });
    return user;
  });
}

export async function loginLocal(
  email: string,
  password: string,
): Promise<User> {
  const normalized = email.toLowerCase();
  const account = await prisma.authAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: "LOCAL",
        providerUserId: normalized,
      },
    },
    include: { user: true },
  });

  // Constant-ish work + generic error to avoid user enumeration.
  if (!account?.passwordHash) {
    throw new UnauthorizedError("Invalid email or password");
  }
  const ok = await verifyPassword(password, account.passwordHash);
  if (!ok) {
    throw new UnauthorizedError("Invalid email or password");
  }
  return account.user;
}

// Add or change the LOCAL password for an already-authenticated user. This is
// how OAuth-only users gain password login.
export async function setLocalPassword(
  userId: string,
  newPassword: string,
  currentPassword?: string,
): Promise<void> {
  const existing = await prisma.authAccount.findUnique({
    where: { userId_provider: { userId, provider: "LOCAL" } },
  });

  const passwordHash = await hashPassword(newPassword);

  if (existing) {
    // Changing an existing password requires the current one.
    if (!existing.passwordHash) {
      // no-op safety
    } else {
      if (!currentPassword) {
        throw new BadRequestError("Current password is required");
      }
      const ok = await verifyPassword(currentPassword, existing.passwordHash);
      if (!ok) throw new UnauthorizedError("Current password is incorrect");
    }
    await prisma.authAccount.update({
      where: { id: existing.id },
      data: { passwordHash },
    });
    return;
  }

  // First-time password: derive the LOCAL identifier from a known email.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: true },
  });
  if (!user) throw new NotFoundError("User not found");

  const emailAccount = user.accounts.find((a) => a.email);
  if (!emailAccount?.email) {
    throw new BadRequestError(
      "No email on file to associate with a password login",
    );
  }

  await prisma.authAccount.create({
    data: {
      userId,
      provider: "LOCAL",
      providerUserId: emailAccount.email,
      email: emailAccount.email,
      emailVerified: emailAccount.emailVerified,
      passwordHash,
    },
  });
}

// ---------------- OAuth (Google / GitHub) ----------------

// Persist provider-specific fields. Tokens are encrypted; we only bother for
// GitHub (which we use for repo access) but the shape is generic.
function providerTokenData(profile: OAuthProfile) {
  const persistTokens = profile.provider === "GITHUB";
  return {
    email: profile.email,
    emailVerified: profile.emailVerified,
    scopes: profile.scopes,
    expiresAt: profile.expiresAt,
    encryptedAccessToken: persistTokens
      ? encryptNullable(profile.accessToken)
      : null,
    encryptedRefreshToken: persistTokens
      ? encryptNullable(profile.refreshToken)
      : null,
  };
}

interface OAuthResult {
  user: User;
  linked: boolean;
  created: boolean;
}

// Core OAuth resolution: find-or-create AuthAccount, find-or-create/link User.
export async function resolveOAuthLogin(
  profile: OAuthProfile,
): Promise<OAuthResult> {
  // 1. Existing account for this exact provider identity -> just refresh tokens.
  const existing = await prisma.authAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    },
    include: { user: true },
  });

  if (existing) {
    await prisma.authAccount.update({
      where: { id: existing.id },
      data: providerTokenData(profile),
    });
    return { user: existing.user, linked: false, created: false };
  }

  // 2. Auto-link to an existing user when the provider email is verified and
  //    already belongs to another (verified) account. Prevents duplicate users.
  if (profile.email && profile.emailVerified) {
    const emailMatch = await prisma.authAccount.findFirst({
      where: { email: profile.email, emailVerified: true },
      include: { user: true },
    });
    if (emailMatch) {
      const user = await linkAccountToUser(emailMatch.userId, profile);
      return { user, linked: true, created: false };
    }
  }

  // 3. Brand-new user.
  const user = await prisma.$transaction(async (tx) => {
    const username = await generateUniqueUsername(profile.username, tx);
    return tx.user.create({
      data: {
        username,
        displayName: profile.displayName || username,
        avatar: profile.avatar,
        accounts: {
          create: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
            ...providerTokenData(profile),
          },
        },
      },
    });
  });
  return { user, linked: false, created: true };
}

// Explicitly link an OAuth account to an already-authenticated user.
export async function linkOAuthAccount(
  userId: string,
  profile: OAuthProfile,
): Promise<User> {
  const existing = await prisma.authAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    },
  });

  if (existing) {
    if (existing.userId !== userId) {
      throw new ConflictError(
        "This account is already linked to a different user",
      );
    }
    // Already linked to this user — refresh tokens.
    await prisma.authAccount.update({
      where: { id: existing.id },
      data: providerTokenData(profile),
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return user;
  }

  return linkAccountToUser(userId, profile);
}

async function linkAccountToUser(
  userId: string,
  profile: OAuthProfile,
): Promise<User> {
  // Enforce one account per provider per user (unique [userId, provider]).
  const providerTaken = await prisma.authAccount.findUnique({
    where: { userId_provider: { userId, provider: profile.provider } },
  });
  if (providerTaken) {
    throw new ConflictError(
      `A ${profile.provider} account is already linked to this user`,
    );
  }

  await prisma.authAccount.create({
    data: {
      userId,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      ...providerTokenData(profile),
    },
  });
  return prisma.user.findUniqueOrThrow({ where: { id: userId } });
}

// Unlink a provider, refusing to leave the user with no way to log in.
export async function unlinkAccount(
  userId: string,
  provider: OAuthProfile["provider"] | "LOCAL",
): Promise<void> {
  const accounts = await prisma.authAccount.findMany({ where: { userId } });
  const target = accounts.find((a) => a.provider === provider);
  if (!target) throw new NotFoundError("No such linked account");
  if (accounts.length <= 1) {
    throw new ForbiddenError("Cannot unlink your only login method");
  }
  await prisma.authAccount.delete({ where: { id: target.id } });
}

export async function listLinkedAccounts(userId: string) {
  const accounts = await prisma.authAccount.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      email: true,
      emailVerified: true,
      scopes: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return accounts;
}
