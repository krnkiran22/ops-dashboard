"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

export default function StaffClaimPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";

  useEffect(() => {
    const timer = setTimeout(() => {
      void token;
      router.push("/");
    }, 1200);
    return () => clearTimeout(timer);
  }, [router, token]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="text-center space-y-2">
          <span className="text-xl font-bold tracking-tight text-foreground font-display">
            build
          </span>
          <p className="text-label mt-4">Staff Onboarding</p>
        </div>

        <div className="border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-semibold">Invite Accepted (Dummy)</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Redirecting to the dashboard...
          </p>
          <div className="mt-4 flex items-center justify-center">
            <Spinner className="size-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
