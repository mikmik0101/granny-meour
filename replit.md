# Granny Meour

A feminine, handmade crochet boutique showcase — a catalog-only site where visitors browse products and inquire directly with the maker. No cart, no checkout, no payments.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run migrate-images` — migrate existing Replit Object Storage images to Cloudinary (run with `--dry-run` first to preview)

Required environment variables:
- `DATABASE_URL` — Postgres connection string
- `CROCHET_ADMIN_EMAIL` — Clerk email of the single admin user
- `CLERK_SECRET_KEY` — Clerk secret key for admin auth
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key
- `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name
- `CLOUDINARY_API_KEY` — Cloudinary API key
- `CLOUDINARY_API_SECRET` — Cloudinary API secret (server-only, never expose to frontend)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Image Storage: Cloudinary
- Auth: Clerk

## Where things live

- `artifacts/api-server/` — Express API server
  - `src/routes/crochet.ts` — Product, category, settings, dashboard routes (admin-protected)
  - `src/routes/storage.ts` — Cloudinary image upload/delete endpoints (admin-protected)
  - `src/lib/cloudinary.ts` — Cloudinary service (upload, delete, optimized URLs)
- `artifacts/crochet-boutique/` — React frontend (Vite + wouter + TanStack Query)
  - `src/App.tsx` — All pages: Home, Products, ProductDetail, About, Contact, Admin (Dashboard, Products, Categories, Settings)
  - `src/index.css` — Design tokens: Playfair Display, yarn-art gradients, paper grain, feminine palette
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 spec (source of truth for API contracts)
- `lib/api-zod/` — Generated Zod schemas from OpenAPI
- `lib/api-client-react/` — Generated React Query hooks + custom fetch
- `lib/db/` — Drizzle schema (`crochet.ts`: products, categories, settings)
- `scripts/` — Utility scripts (migration, etc.)

## Architecture decisions

- **Single-admin policy**: Only the Clerk user matching `CROCHET_ADMIN_EMAIL` can access admin routes. Enforced server-side in `requireAdmin()` middleware.
- **Catalog-only, no e-commerce**: Prices are informational (PHP via `Intl.NumberFormat`). Visitors inquire via contact methods (email, Instagram, Messenger). No cart, checkout, payment gateways, or automated ordering.
- **Cloudinary for images**: All product images uploaded via admin are stored in Cloudinary. Secure HTTPS delivery URLs stored in DB (`image`, `additionalImages[]`). Cloudinary credentials never leave the server.
- **Multi-image support**: Products support a cover image (`image`) + gallery (`additionalImages[]`). Admin can upload multiple, reorder, set cover, delete individual images.
- **Migration-safe**: Existing Replit Object Storage URLs are preserved. Migration script fetches, uploads to Cloudinary, updates DB. Old assets not auto-deleted.
- **Generated API layer**: OpenAPI → Zod → React Query hooks. Never edit generated files; update `openapi.yaml` then run codegen.

## Product

- Public catalog: search, category filter, sort (newest/price/name), URL state sync
- Product detail: multi-image gallery, thumbnails, fullscreen modal, keyboard/swipe nav
- Inquiry modal: product-aware, mailto with subject, tel/https links for contact methods
- Admin dashboard: stats, recent products, quick actions
- Admin product CRUD: create/edit/delete with multi-image upload, cover selection, reorder
- Admin category CRUD with product counts
- Admin site settings: brand, hero, about, contact methods (Instagram, Email, Messenger, Facebook, Phone)
- Responsive: mobile-first, 320px+, tablet, desktop — no horizontal overflow
- Feminine aesthetic: Playfair Display serif, DM Sans, yarn-art gradients, paper grain, soft shadows, rounded corners, blush/pink/cream palette

## User preferences

- Preserve the girly, handmade, feminine crochet boutique feel at all times
- No corporate/SaaS styling
- No e-commerce features
- Security: admin auth on every mutation, Cloudinary secret server-only

## Gotchas

- **Always run codegen after changing openapi.yaml**: `pnpm --filter @workspace/api-spec run codegen` → regenerates Zod + React client
- **Admin auth is server-side**: Frontend `/api/admin/access` check is UI-only; real protection is `requireAdmin()` in every admin route
- **Cloudinary secret never in frontend**: Only `CLOUDINARY_CLOUD_NAME` could be public; `API_KEY` and `API_SECRET` must stay server-only
- **Image URLs in DB are HTTPS Cloudinary delivery URLs**: e.g. `https://res.cloudinary.com/<cloud>/image/upload/v123/crochet-boutique/products/abc.jpg`
- **Migration script**: Run `pnpm --filter @workspace/scripts run migrate-images -- --dry-run` first, then without `--dry-run` to apply
- **Replit Object Storage removed**: No more `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`, `@google-cloud/storage`, or Replit sidecar dependency

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details