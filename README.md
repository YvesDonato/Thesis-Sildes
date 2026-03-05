This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker Compose / Coolify

This repo now includes:

- `Dockerfile` (multi-stage production build)
- `docker-compose.yml` and `docker-compose.yaml` (service on port `3000`)
- `.dockerignore`

Run locally with Docker Compose:

```bash
SESSION_SECRET="replace-with-a-strong-secret" docker compose up --build
```

For Coolify:

- Deploy as a Docker Compose application using `docker-compose.yaml`.
- Set `SESSION_SECRET` in Coolify environment variables (do not use the default placeholder).
- Exposed service port is `3000`.

## LaTeX Block Rendering

Slides support fenced blocks with `latex +render`.

For table blocks, the app parses `\begin{tabular}...\end{tabular}` and renders them as HTML tables directly in slides.

Unsupported LaTeX constructs are left as fenced code blocks and the app logs a warning.

## Admin Presenter Mode

- `GET /admin` provides presenter controls.
- Password is `password` (basic protection as requested).
- Viewer route `/` follows presenter slide moves globally via SSE (`/api/presenter/stream`).
- Incremental bullet reveals are also synchronized globally (`slideIndex` + `revealStep`).
- Viewer route is follower-only (no local controls), so all open viewers stay on the presenter timeline.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
