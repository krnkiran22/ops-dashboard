/**
 * Clerk token helper for browser-side API calls.
 *
 * Waits for Clerk to initialise, then exposes getAuthToken() which
 * every API call uses for the Authorization header.
 */

let _clerkReadyPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _waitForClerk(maxWaitMs = 5000): Promise<void> {
  if (!_clerkReadyPromise) {
    _clerkReadyPromise = new Promise<void>((resolve) => {
      if (typeof window === "undefined") {
        resolve();
        return;
      }
      if (window.Clerk?.loaded) {
        resolve();
        return;
      }
      const start = Date.now();
      const check = () => {
        if (window.Clerk?.loaded || Date.now() - start >= maxWaitMs) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }
  return _clerkReadyPromise;
}

export async function getAuthToken(
  options: { retries?: number; retryDelayMs?: number } = {}
): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const envToken = process.env.NEXT_PUBLIC_OPS_API_BEARER?.trim();
  if (envToken) return envToken;

  const stored = window.localStorage.getItem("buildai_ops_bearer")?.trim();
  if (stored) return stored;

  await _waitForClerk();

  const retries = Math.max(0, options.retries ?? 1);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 75);
  const session = window.Clerk?.session;
  if (!session) return null;

  // Guard against dead/invalid sessions where getToken hangs
  const tokenWithTimeout = (): Promise<string | null> =>
    Promise.race([
      session.getToken().then((t) => t ?? null),
      sleep(3000).then(() => null),
    ]);

  let token = await tokenWithTimeout();
  for (let attempt = 0; !token && attempt < retries; attempt += 1) {
    await sleep(retryDelayMs);
    token = await tokenWithTimeout();
  }
  return token;
}

export function extractApiError(body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    const errMsg = (b.error as Record<string, unknown>)?.message;
    if (typeof errMsg === "string") return errMsg;
    if (typeof b.detail === "string") return b.detail;
  }
  return "Unknown error";
}
