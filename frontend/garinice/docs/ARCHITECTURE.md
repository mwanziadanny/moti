# Architecture

## Principles
- **One contract, two implementations.** UI code only calls `src/api/index.js`. `src/api/client.js` routes each call either to the real backend (`VITE_API_URL`) or to the in-browser mock backend (`src/api/mock`). Both honour the contract in [API.md](API.md).
- **The server is the authority.** Prices, roles, seller identity, image URLs, listing status and payment state are all decided server-side. The UI never sends a payment amount, and it can't mark a payment successful; it only polls. Client guards (`RequireAuth`) are UX only.
- **One validation source.** `src/lib/schemas.js` (Zod) validates forms, wizard steps and API inputs. The backend should import the same module, or a generated equivalent.
- **URL is state.** Inventory filters, sort and page live in query parameters (`src/lib/filters.js`), so results can be shared, bookmarked and crawled, and browser back/forward works.

## Frontend layers
| Layer | Location | Notes |
|---|---|---|
| Design tokens | `src/index.css` (`@theme`) | Brand palette (#123B5D / #0F766E / #F59E0B), type scale, shadows, motion (reduced-motion aware) |
| UI kit | `src/components/ui` | Accessible primitives: focus-trapped dialogs, ARIA tabs/menus/combobox, skeletons, empty/error states |
| Domain components | `src/components/{vehicle,search,layout}` | Cards, gallery and fullscreen viewer, filter panel, hero search |
| Features | `src/features` | Auth prompt, inbox, uploader, M-Pesa checkout |
| Pages | `src/pages` | Route screens, lazy-loaded per area (`src/app/routes.jsx`) |
| Data | `src/hooks/queries.js` + TanStack Query | Caching, optimistic favourites/messages, polling for inbox and payments |

## Mock backend (`src/api/mock`)
A real request pipeline, not fixtures:
`server.handle()` → resolve session from the bearer token (SHA-256 hashed in `sessions`) → run scheduled jobs (listing expiry and reminders) → maintenance mode check → route match → handler (validation via Zod, RBAC guards, rate limits) → audit log, notifications and outbox → persist to IndexedDB.

Key modules:
- `listingService.js`: the listing state machine (DRAFT → PENDING_REVIEW → PUBLISHED → PAUSED/SOLD/EXPIRED/REJECTED/ARCHIVED), quota enforcement, auto-approval for verified dealers, moderation history.
- `handlers/payments.js`: M-Pesa STK-push flow. The amount comes from the package. Each payment has an idempotency key. The gateway callback is HMAC-SHA256 signed, verified, deduplicated by `eventId`, and ignored once the payment is final. A mismatched amount fails the payment.
- `vehicleUtils.js`: search scoring with exact, prefix and Levenshtein matching across make, model, aliases, body, seller, location and reference ID. It also builds DTOs that only expose the contact channels the seller enabled.

## Backend hand-off (recommended production stack)
- **API:** Node (NestJS or Fastify), PostgreSQL via Prisma or Drizzle, domain modules matching `handlers/*`.
- **Sessions:** httpOnly, Secure, SameSite=Lax cookie plus a CSRF double-submit token (`gn_csrf` cookie → `X-CSRF-Token` header, already sent by `client.js`). Passwords use Argon2id.
- **Search:** start with Postgres FTS plus `pg_trgm` for typo tolerance, with composite indexes on (status, brand_id, model_id, price), (status, body_type_id, price), (status, year) and (status, published_at). Move to Meilisearch or OpenSearch past about 500k listings, syncing via an outbox.
- **Images:** pre-signed uploads to S3-compatible object storage, then a worker that validates the MIME type and magic bytes, strips EXIF, and generates WebP and AVIF at 480/960/1600w, served from a CDN. The client already resizes to WebP and strips EXIF before upload.
- **Payments:** Safaricom Daraja STK push, callback URL verification, idempotency keys and a payments state machine. The design is gateway-pluggable (card and bank are stubbed in settings).
- **Notifications:** an `outbox` table drained by a worker (email via SES or Postmark, SMS via Africa's Talking, WhatsApp via the Cloud API).
- **Rate limiting:** Redis sliding windows with the same buckets as `http.js#rateLimit`.

## SEO & rendering
- Every route sets the title, description, canonical, Open Graph and Twitter tags through `<Seo>` (React 19 hoists them into `<head>`). Vehicle pages emit `Car` + `Offer` JSON-LD, dealers emit `AutoDealer`, the FAQ emits `FAQPage`, and inventory pages emit `ItemList`.
- Landing pages (`/cars/:make`, `/cars/body/:body`, `/cars/price/:range`) render live market statistics (count, price range, median, top models, body and fuel split) plus admin-editable intros, so they are not thin duplicates.
- `npm run build` generates `sitemap.xml` (index) with page, category, dealer and vehicle sitemaps. In production the backend serves these dynamically.
- **Pre-rendering:** the app uses data routers with lazy routes. For crawlers that don't run JavaScript, deploy either (a) React Router framework mode with SSR, reusing `src/app/routes.jsx`, or (b) edge pre-rendering of `/`, `/cars*`, `/vehicle/*` and `/dealer/*`.

## Performance
Route-level code splitting (the mock backend is its own lazy chunk), lazy and `decoding=async` images with intrinsic sizes, `srcset` for uploaded photos, only adjacent gallery images mounted, `keepPreviousData` to avoid blank results between filter changes, skeletons everywhere, and pagination (24 per page).

## Accessibility (WCAG 2.2 AA targets)
Skip link, semantic landmarks, visible focus rings, focus-trapped and restoring dialogs, Escape to close, keyboard gallery (arrows, Enter), ARIA tabs/menu/combobox, `aria-live` result counts and toasts, labelled icon buttons, form errors tied via `aria-describedby`, reduced-motion support, and AA-contrast palette choices (amber CTAs use dark text).
