# REST API contract

All responses are JSON. Errors use one shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Some fields need your attention.", "fieldErrors": { "price": "Price must be at least 50,000" } } }
```

Codes: `BAD_REQUEST` 400 · `UNAUTHENTICATED` 401 · `INVALID_CREDENTIALS` 401 · `INVALID_SIGNATURE` 401 · `QUOTA_EXCEEDED` 402 · `FORBIDDEN` / `ACCOUNT_SUSPENDED` / `HIDDEN_BY_ADMIN` 403 · `NOT_FOUND` 404 · `CONFLICT` / `EMAIL_TAKEN` / `ALREADY_REPORTED` 409 · `TOO_LARGE` 413 · `UNSUPPORTED_MEDIA` 415 · `VALIDATION_FAILED` 422 · `RATE_LIMITED` 429 · `MAINTENANCE` 503.

Lists return `{ items, total, page, pageSize, pageCount }`. Auth is a session cookie (production) or bearer token (mock). Mutating requests carry `X-CSRF-Token`.

The reference implementation is `src/api/mock/handlers/*`. Validation schemas are in `src/lib/schemas.js`.

## Auth & account
| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/register | `registerSchema`. DEALER also creates an unverified dealer and storefront. Rate-limited. |
| POST | /api/auth/login | Suspended accounts get 403. Rate-limited to 10 per 5 min. |
| POST | /api/auth/logout | |
| GET | /api/auth/me | `{ user \| null }` |
| POST | /api/auth/forgot-password | Always 200 (no user enumeration). Reset token expires in 1 hour. |
| POST | /api/auth/reset-password | Revokes all sessions. |
| PATCH | /api/account | `profileSchema`, notification preferences. |
| POST | /api/account/password | Requires the current password. Revokes other sessions. |
| DELETE | /api/account | `{ password }`. Soft-deletes and archives listings. |

## Catalogue (public)
| Method | Path | Notes |
|---|---|---|
| GET | /api/taxonomy | Brands, models (with live counts), body types, fuels, transmissions, locations, features, counties. |
| GET | /api/vehicles | Filters: `q, make, model, body, fuel, transmission, drive, condition, import, location, minPrice, maxPrice, minYear, maxYear, minEngine, maxEngine, maxMileage, sellerType, verified, dealer, features, availability, sort, page, pageSize, facets=1`. |
| GET | /api/vehicles/:slugOrId | Public detail. Owners and admins also get draft/pending listings plus moderation data. |
| GET | /api/vehicles/:id/related | |
| POST | /api/vehicles/:id/view | Deduplicated per visitor per day. |
| POST | /api/events | `PHONE_CLICK, WHATSAPP_CLICK, EMAIL_CLICK, SHARE`. |
| GET | /api/search/suggest?q= | Makes, models, body types, dealers, reference IDs. |
| GET | /api/home | Homepage settings, featured, latest, brand/body/price counts, dealers. |
| GET | /api/landing | Same filters as above. Returns market stats and the SEO record. |
| GET | /api/dealers, /api/dealers/:slug | Directory and storefront (with stats). |
| GET | /api/pages/:slug · /api/seo?path= · /api/packages · /api/sitemap | |
| POST | /api/contact | Rate-limited. |

## Seller
| Method | Path | Notes |
|---|---|---|
| GET | /api/me/vehicles | Own listings (or the dealership's), with status counts. |
| GET | /api/me/quota | Active-listing allowance. |
| POST | /api/vehicles | `{ data, submit }`. A draft uses the partial schema; submit uses the full schema plus cross-field rules. Seller/dealer comes from the session. Image IDs must be the caller's uploads. |
| PATCH | /api/vehicles/:id | Owner, dealer team or admin. Changing photos, description or model on a published listing re-queues it for review. |
| POST | /api/vehicles/:id/status | `submit, pause, resume, mark_sold, relist, archive`. Enforced by the state machine. |
| DELETE | /api/vehicles/:id | Soft delete. |
| POST | /api/uploads | `{ kind: image\|document, dataUrl, … }`. Checks MIME, size and dimensions. Production: pre-signed URL. |
| GET | /api/me/analytics?days= · /api/me/leads | |
| GET/PATCH | /api/dealer | Storefront. Only the owner can edit. |
| GET/POST/DELETE | /api/dealer/staff[/:userId] | Only the owner can manage staff. |

## Social
| Method | Path |
|---|---|
| GET | /api/favourites, /api/favourites/ids |
| POST / DELETE | /api/favourites, /api/favourites/:vehicleId |
| GET / POST | /api/conversations (`{ vehicleId, body }`) |
| GET | /api/conversations/unread, /api/conversations/:id (marks read) |
| POST | /api/conversations/:id/messages |
| GET / POST | /api/notifications, /api/notifications/read |
| POST | /api/reports (anonymous allowed, deduplicated, rate-limited) |

## Payments
| Method | Path | Notes |
|---|---|---|
| POST | /api/payments | `{ packageId, vehicleId?, method, phone, idempotencyKey }`. The amount is taken from the package. Returns PROCESSING. |
| GET | /api/payments, /api/payments/:id | The client polls this; it can never set the status. |
| POST | /api/payments/webhook | Header `x-gateway-signature` = HMAC-SHA256 of the body. Deduplicated by `eventId`. Final states are immutable. Amount must match. |
| POST | /api/admin/payments/:id/refund | Admin only. |

## Admin (ADMIN, SUPER_ADMIN)
`GET /api/admin/overview?days` · `GET /api/admin/vehicles` · `GET /api/admin/vehicles/:id` · `POST /api/admin/vehicles/:id/moderate {action: approve|reject|request_changes|hide|unhide|feature|unfeature|delete, note}` · `POST /api/admin/vehicles/bulk {ids, action}` · `POST /api/admin/vehicles/:id/seller` · `GET/PATCH /api/admin/users[/:id]` (role changes are SUPER_ADMIN only) · `GET/PATCH /api/admin/dealers[/:id]` · `GET /api/admin/reports`, `POST /api/admin/reports/:id {action: dismiss|warn_seller|suspend_listing|suspend_seller}` · `GET /api/admin/payments` · `GET /api/admin/conversations[/:id]`, `DELETE /api/admin/messages/:id` · CRUD at `/api/admin/{brands|models|body-types|packages|promotions|pages|seo}` · `GET/PATCH /api/admin/settings` · `GET /api/admin/audit-logs` · `GET /api/admin/outbox` · `GET /api/admin/contact-messages` · `POST /api/admin/reset-demo` (SUPER_ADMIN, demo only).
