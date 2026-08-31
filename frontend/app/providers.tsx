"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { RealtimeProvider } from "@/lib/realtime/RealtimeProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <RealtimeProvider>{children}</RealtimeProvider>
    </AuthProvider>
  );
}
