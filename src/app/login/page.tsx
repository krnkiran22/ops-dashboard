"use client";

import { useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <div className="w-full max-w-xs border border-border bg-card p-5 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-lg font-bold tracking-tight">build</p>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Login (Dummy)
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Email
          </label>
          <input
            type="email"
            className="w-full h-10 border border-input bg-transparent px-3 text-sm outline-none"
            placeholder="you@build.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Link
          href="/"
          className="block w-full h-10 bg-primary text-primary-foreground text-sm font-semibold text-center leading-10"
        >
          Continue
        </Link>
      </div>
    </div>
  );
}
