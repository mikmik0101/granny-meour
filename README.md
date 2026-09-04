# Granny Meour

A feminine, handmade crochet boutique showcase — a catalog-only site where visitors browse products and inquire directly with the maker. No cart, no checkout, no payments.

## Deployment

### Production Stack
- **Frontend & API Hosting**: Vercel
- **Database**: Neon (PostgreSQL)
- **Image Storage**: Cloudinary
- **Authentication**: Clerk

### Quick Deploy to Vercel

1. **Connect Repository**: Import this repository to Vercel
2. **Configure Environment Variables** (see below)
3. **Deploy**: Vercel will automatically build and deploy

### Environment Variables (Required)

Set these in Vercel → Project Settings → Environment Variables:

```bash
# Database (Neon)
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CROCHET_ADMIN_EMAILS=michacullamat@gmail.com,mickaelcullamat01@gmail.com

# Cloudinary Image Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Build Configuration
PORT=3000
BASE_PATH=/
NODE_ENV=production
```

### Build Configuration

Vercel automatically detects the monorepo structure via `vercel.json`:
- **API**: `artifacts/api-server/` builds to `dist/index.mjs`
- **Frontend**: `artifacts/crochet-boutique/` builds to `dist/public/`
- **Routes**: `/api/*` → API server, `/*` → frontend

### Database Setup

1. Create a Neon database: https://neon.tech
2. Copy connection string to `DATABASE_URL`
3. Push schema: `pnpm --filter @workspace/db run push`

### Image Migration

After first deploy, migrate existing images to Cloudinary:

```bash
# Dry run first
pnpm --filter @workspace/scripts run migrate-images -- --dry-run

# Apply migration
pnpm --filter @workspace/scripts run migrate-images
```

---

## Local Development

### Prerequisites
- Node.js 24+
- pnpm 9+
- PostgreSQL (or Neon connection)

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Push database schema
pnpm --filter @workspace/db run push

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend (separate terminal)
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/crochet-boutique run dev
```

### Development Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/scripts run migrate-images` — migrate images to Cloudinary

---

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (API), Vite (frontend)
- Image Storage: Cloudinary
- Auth: Clerk
- Frontend: React 19, wouter, TanStack Query, Tailwind CSS v4

## Architecture

### File Structure

- `artifacts/api-server/` — Express API server
  - `src/routes/crochet.ts` — Product, category, settings, dashboard routes (admin-protected)
  - `src/routes/storage.ts` — Cloudinary image upload/delete endpoints (admin-protected)
  - `src/lib/cloudinary.ts` — Cloudinary service (upload, delete, optimized URLs)
- `artifacts/crochet-boutique/` — React frontend (Vite + wouter + TanStack Query)
  - `src/App.tsx` — All pages: Home, Products, ProductDetail, About, Contact, Admin
  - `src/index.css` — Design tokens: Playfair Display, yarn-art gradients, paper grain
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 spec (source of truth for API contracts)
- `lib/api-zod/` — Generated Zod schemas from OpenAPI
- `lib/api-client-react/` — Generated React Query hooks + custom fetch
- `lib/db/` — Drizzle schema (`crochet.ts`: products, categories, settings)
- `scripts/` — Utility scripts (migration, etc.)

### Key Decisions

- **Multi-admin policy**: Clerk users matching any email in `CROCHET_ADMIN_EMAILS` (comma-separated list) can access admin routes. Enforced server-side in `requireAdmin()` middleware.
- **Catalog-only, no e-commerce**: Prices are informational (PHP via `Intl.NumberFormat`). Visitors inquire via contact methods (email, Instagram, Messenger). No cart, checkout, payment gateways, or automated ordering.
- **Cloudinary for images**: All product images uploaded via admin are stored in Cloudinary. Secure HTTPS delivery URLs stored in DB (`image`, `additionalImages[]`). Cloudinary credentials never leave the server.
- **Multi-image support**: Products support a cover image (`image`) + gallery (`additionalImages[]`). Admin can upload multiple, reorder, set cover, delete individual images.
- **Generated API layer**: OpenAPI → Zod → React Query hooks. Never edit generated files; update `openapi.yaml` then run codegen.

## Features

### Public
- Product catalog: search, category filter, sort (newest/price/name), URL state sync
- Product detail: multi-image gallery, thumbnails, fullscreen modal, keyboard/swipe nav
- Inquiry modal: product-aware, mailto with subject, tel/https links for contact methods
- Responsive: mobile-first, 320px+, tablet, desktop

### Admin
- Dashboard: stats, recent products, quick actions
- Product CRUD: create/edit/delete with multi-image upload, cover selection, reorder
- Category CRUD with product counts
- Site settings: brand, hero, about, contact methods (Instagram, Email, Messenger, Facebook, Phone)

### Design
- Feminine aesthetic: Playfair Display serif, DM Sans, yarn-art gradients, paper grain, soft shadows, rounded corners, blush/pink/cream palette

## Security

- Admin auth on every mutation (server-side `requireAdmin()`)
- Cloudinary secret server-only
- Clerk primary email verification
- File validation (MIME type, size)
- Admin-only upload/delete endpoints

## Gotchas

- **Always run codegen after changing openapi.yaml**: `pnpm --filter @workspace/api-spec run codegen`
- **Admin auth is server-side**: Frontend `/api/admin/access` check is UI-only
- **Cloudinary secret never in frontend**: Only `CLOUDINARY_CLOUD_NAME` could be public
- **Image URLs in DB are HTTPS Cloudinary delivery URLs**
- **Migration script**: Run with `--dry-run` first
- **No Replit dependencies**: Removed all Replit-specific packages and configuration