"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

export default function Home() {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(isAuthenticated ? "/beranda" : "/login");
  }, [ready, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex size-11 items-center justify-center rounded-[12px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark, no responsive srcset needed */}
        <img
          src="/brand/wealthme-mark.png"
          alt=""
          className="size-full object-contain"
        />
      </div>
    </div>
  );
}
