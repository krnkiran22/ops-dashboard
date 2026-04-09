# ops-dashboard

Staff-facing ops portal (Next.js): operator tasks, sales map, and admin preview routes.

## Local development

```bash
bun install
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) (see `package.json` for the dev port).

### Ops v2 mock API (frontend integration)

To point this app at a **local HTTP mock** on port **8765** with prefix **`/v2/ops`**:

1. Copy `.env.local.example` → `.env.local` and enable the **Ops v2 mock** variable block.
2. Set `NEXT_PUBLIC_MOCK_OPS_API=false` so requests go over the network (not `mock-responses.ts`).
3. Start the mock from the Build AI monorepo (`apps/buildai-api`) if available — see **`docs/ops-v2-mock-api.md`** for the full contract, curl examples, and fixture IDs.

API URL shape: `{NEXT_PUBLIC_BACKEND_API_URL}/{NEXT_PUBLIC_OPS_API_GATEWAY_VERSION}/ops/...`  
(e.g. `http://localhost:8765/v2/ops/leads`).

### Default API base (ngrok)

If `NEXT_PUBLIC_BACKEND_API_URL` is **not** set, the app calls the shared **ngrok** tunnel defined in `src/lib/api/client.ts` (`DEFAULT_TUNNEL_API_BASE_URL`). Update that constant (or set the env var) when the tunnel rotates. Browser requests add `ngrok-skip-browser-warning: true` automatically for `*.ngrok-free.dev` / `*.ngrok-free.app`.

## Build

```bash
npm run build
```

## Deploy on Vercel

1. Import this repo in [Vercel](https://vercel.com) (framework: Next.js is auto-detected).
2. Add environment variables as needed (e.g. `NEXT_PUBLIC_BACKEND_API_URL`, Clerk keys if used).
3. `vercel.json` pins install/build commands for reproducible builds.

Static assets live under `public/`.
