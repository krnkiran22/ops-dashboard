import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function backendBase(): string | null {
  const b =
    process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() ||
    process.env.BACKEND_PROXY_URL?.trim();
  return b ? b.replace(/\/+$/, "") : null;
}

function gatewaySegment(): string {
  const raw = process.env.NEXT_PUBLIC_OPS_API_GATEWAY_VERSION?.trim() ?? "v2";
  const s = raw.replace(/^\/+|\/+$/g, "");
  return s.length > 0 ? s : "v2";
}

function skipAuth(): boolean {
  const v = process.env.NEXT_PUBLIC_OPS_SKIP_AUTH;
  return v === "true" || v === "1";
}

async function proxyRequest(request: NextRequest, pathSegments: string[]) {
  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_BACKEND_API_URL is not set" },
      { status: 500 }
    );
  }

  const tail = pathSegments.join("/");
  const upstream = new URL(`${base}/${gatewaySegment()}/ops/${tail}`);
  const url = new URL(request.url);
  url.searchParams.forEach((v, k) => {
    upstream.searchParams.set(k, v);
  });

  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);

  if (!skipAuth()) {
    const auth = request.headers.get("authorization");
    if (auth) headers.set("Authorization", auth);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  const res = await fetch(upstream, init);
  const outHeaders = new Headers();
  const resCt = res.headers.get("content-type");
  if (resCt) outHeaders.set("Content-Type", resCt);

  return new NextResponse(await res.arrayBuffer(), {
    status: res.status,
    headers: outHeaders,
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyRequest(request, path ?? []);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyRequest(request, path ?? []);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyRequest(request, path ?? []);
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyRequest(request, path ?? []);
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await ctx.params;
  return proxyRequest(request, path ?? []);
}
