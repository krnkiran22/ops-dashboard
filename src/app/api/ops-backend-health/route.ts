import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase(): string | null {
  const b =
    process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() ||
    process.env.BACKEND_PROXY_URL?.trim();
  return b ? b.replace(/\/+$/, "") : null;
}

function skipAuth(): boolean {
  const v = process.env.NEXT_PUBLIC_OPS_SKIP_AUTH;
  return v === "true" || v === "1";
}

/**
 * Proxies `GET /health` on the API host (not under `/v2/ops`).
 * Same-origin so the browser avoids CORS when using a tunnel or ngrok.
 */
export async function GET(request: NextRequest) {
  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_BACKEND_API_URL is not set" },
      { status: 500 }
    );
  }

  const upstream = new URL(`${base}/health`);
  const url = new URL(request.url);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  const headers = new Headers();
  if (!skipAuth()) {
    const auth = request.headers.get("authorization");
    if (auth) headers.set("Authorization", auth);
  }

  const res = await fetch(upstream, { headers, cache: "no-store" });
  const ct = res.headers.get("content-type");
  const out = new Headers();
  if (ct) out.set("Content-Type", ct);
  return new NextResponse(await res.arrayBuffer(), {
    status: res.status,
    headers: out,
  });
}
