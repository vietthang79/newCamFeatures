"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./auth-context";

const PUBLIC_PATHS = ["/login"];
const ADMIN_PREFIX = "/admin";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      if (session) {
        router.replace("/cameras");
      }
      return;
    }

    if (!session) {
      router.replace("/login");
      return;
    }

    if (pathname.startsWith(ADMIN_PREFIX) && session.role !== "vendor_admin") {
      router.replace("/cameras");
      return;
    }
  }, [session, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      </div>
    );
  }

  if (!session && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return <>{children}</>;
}
