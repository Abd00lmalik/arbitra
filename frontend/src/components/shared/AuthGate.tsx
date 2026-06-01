/*
 * @file AuthGate.tsx
 * @description Client-side authentication guard component that monitors login state and redirects unauthenticated requests.
 */

"use client";

import { useEffect, ReactNode }   from "react";
import { usePathname, useRouter }  from "next/navigation";
import { useWeb3Auth }             from "@/providers/Web3AuthProvider";

/* Public routes that do not require authentication */
const PUBLIC_PATHS = ["/", "/register", "/dashboard"];

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoggedIn, isInitializing } = useWeb3Auth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith("/api/")
  );

  useEffect(() => {
    /* Wait for Web3Auth initialization to finish before checking login state */
    if (isInitializing) return;
    if (isPublic) return;
    if (!isLoggedIn) {
      /* User is unauthenticated and attempting to visit a protected route */
      router.replace(`/register?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoggedIn, isInitializing, isPublic, pathname, router]);

  /* Show visual loader during initialization of protected routes */
  if (isInitializing && !isPublic) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#020714",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "2.5px solid rgba(0, 240, 255, 0.15)",
            borderTopColor: "#00F0FF",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <p
          style={{
            color: "#8B9CC8",
            fontSize: 13,
            fontFamily: "Satoshi, sans-serif",
          }}
        >
          Initializing secure session...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* Prevent rendering of protected route for unauthenticated sessions */
  if (!isLoggedIn && !isPublic && !isInitializing) {
    return null;
  }

  return <>{children}</>;
}
