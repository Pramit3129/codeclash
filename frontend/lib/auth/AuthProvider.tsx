"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { refreshAccessToken } from "./apiClient";
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type User,
} from "./authApi";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    username?: string;
    displayName?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<boolean>;
}

const Ctx = createContext<AuthState | null>(null);

async function loadUser(): Promise<User | null> {
  try {
    const ok = await refreshAccessToken();
    if (!ok) return null;
    const { user } = await getMe();
    return user;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (): Promise<boolean> => {
    const next = await loadUser();
    setUser(next);
    return next !== null;
  }, []);

  useEffect(() => {
    loadUser().then((next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        setUser(await apiLogin(email, password));
      },
      register: async (input) => {
        setUser(await apiRegister(input));
      },
      logout: async () => {
        await apiLogout();
        setUser(null);
      },
      reload,
    }),
    [user, loading, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
