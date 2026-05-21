"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isMounted, router]);

  if (!isMounted || !isAuthenticated) return null;
  return <>{children}</>;
}
