"use client";

import { AppStateProvider } from "@/components/state/app-state";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AppStateProvider>{children}</AppStateProvider>;
}
