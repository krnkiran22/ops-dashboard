# ops-dashboard

Staff-facing ops portal (Next.js): operator tasks, sales map, and admin preview routes.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) (see `package.json` for the dev port).

## Build

```bash
npm run build
```

## Deploy on Vercel

1. Import this repo in [Vercel](https://vercel.com) (framework: Next.js is auto-detected).
2. Add environment variables as needed (e.g. `NEXT_PUBLIC_BACKEND_API_URL`, Clerk keys if used).
3. `vercel.json` pins install/build commands for reproducible builds.

Static assets live under `public/`.
