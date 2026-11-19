# Flax web client

Next.js 16 (App Router) frontend for [Flax](https://www.useflax.cc), deployed on Vercel. The API lives in `../server` (Express, on Render).

## How it is put together

The app is a **hybrid**:

| Part | Where | Rendering |
|---|---|---|
| Public site: landing `/`, `/foods/**`, `/tools/calorie-calculator`, `/about`, `/privacy`, `/terms` | `src/app/(public)/` | Server rendered / static (ISR, revalidates hourly). Full HTML for search engines. |
| Signed in app and auth screens: `/home`, `/spin`, `/dashboard`, `/ask-noura`, `/profile`, `/settings`, `/notifications`, `/onboarding`, `/login`, `/register`, … | `src/app/[...app]/` mounts `src/spa/SpaApp.tsx` → `src/router/index.tsx` (React Router) | Client only (`ssr: false`), `noindex`. |
| SEO plumbing | `src/app/sitemap.ts`, `robots.ts`, `llms.txt/`, `indexnow-key.txt/`, `not-found.tsx`, `src/lib/seo.tsx`, `src/lib/site.ts` | Generated |

Rules that keep this working:

- **Adding an app route**: add the `<Route>` in `src/router/index.tsx` **and** the path in `src/lib/spaRoutes.ts`. A path missing from `spaRoutes.ts` returns 404 on refresh.
- **Links from the app to public pages** must be full page loads (`HardRedirect` / `window.location`), never `navigate()`.
- **Public pages must not depend on theme in markup** (use Tailwind `dark:` classes) and must never call the API from the browser. A crawler must never be redirected away.
- Food pages read `GET /api/public/foods` server side (`src/lib/foods.ts`). If the backend is unreachable during a build the build still succeeds and pages regenerate later. At request time an outage returns a temporary 5xx, never a 404.

## Scripts

```bash
npm run dev         # next dev on :5173
npm run build       # production build
npm run start       # serve the build
npm run lint
npm run type-check
npm run indexnow    # submit sitemap URLs to Bing/Yandex via IndexNow (needs INDEXNOW_KEY)
```

Local development against a local API: set `API_PROXY_TARGET=http://localhost:3000` (proxies `/api/*`, replaces the old Vite proxy) and `API_ORIGIN=http://localhost:3000` (server side food data).

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | build | Axios base URL. Leave empty in production, `/api/*` is proxied on the same origin by `vercel.json`. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` | build | Google sign in. |
| `NEXT_PUBLIC_SHOW_DELETE_ACCOUNT` | build | `"true"` shows delete account in Settings. |
| `API_ORIGIN` | server | Backend origin for food pages. Default `https://flax-148t.onrender.com`. |
| `GOOGLE_SITE_VERIFICATION` | server | Google Search Console HTML tag token (optional). |
| `BING_SITE_VERIFICATION` | server | Bing Webmaster `msvalidate.01` token (optional). |
| `INDEXNOW_KEY` | server | IndexNow key served at `/indexnow-key.txt` (optional). |
| `API_PROXY_TARGET` | dev only | Local API proxy target. |

The old `VITE_*` names still work as a fallback (`next.config.ts`), so an existing Vercel project builds without renaming, but rename them when convenient.

## Deploying this migration (first time)

1. **Deploy the backend first** (Render) so `GET /api/public/foods` exists. It is additive and read only.
2. Push the branch and open the **Vercel preview**. `vercel.json` sets the framework to Next.js. In Vercel → Project → Settings → Build & Development, make sure no leftover Vite overrides are set (Output Directory `dist`, custom Build Command). Leave them on default.
3. On the preview, check: `/`, a food page, `/tools/calorie-calculator`, log in (email), log out, a refresh on `/home`, `/sitemap.xml`, `/robots.txt`. Google sign in only works on the production domain.
4. Merge to production.
5. Search engines:
   - Google Search Console: add the `https://www.useflax.cc` property (or the Domain property), submit `https://www.useflax.cc/sitemap.xml`, then use URL Inspection → Request indexing on `/`.
   - Bing Webmaster Tools: import from Search Console or verify with `BING_SITE_VERIFICATION`, submit the sitemap.
   - Optional: set `INDEXNOW_KEY` in Vercel and run `INDEXNOW_KEY=... npm run indexnow` after deploys that add pages.
