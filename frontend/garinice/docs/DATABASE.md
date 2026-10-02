# Database design (PostgreSQL)

UUID primary keys (`gen_random_uuid()`); `created_at` and `updated_at` timestamps everywhere; `deleted_at` soft deletes where noted. Money is stored as `bigint` KES (no floats). The mock store in `src/api/mock/db.js` mirrors these tables. The mock combines Vehicle and Listing into one record; production splits them as below.

## Core entities
| Table | Key columns | Notes |
|---|---|---|
| users | email (citext, unique), phone, password_hash, role (enum BUYER, PRIVATE_SELLER, DEALER, DEALER_STAFF, ADMIN, SUPER_ADMIN), verified, suspended, email_verified, last_login_at, deleted_at | |
| profiles | user_id (unique FK), location, bio, avatar_url, notify_email/sms/whatsapp | User 1→1 Profile |
| sessions | user_id FK, token_hash (unique), expires_at, user_agent, ip | |
| password_resets | user_id FK, token_hash, expires_at, used_at | |
| dealers | slug (unique), name, owner_id FK users, contact fields, county, town, location_id FK, logo_url, cover_url, verified, verified_at, suspended, deleted_at | |
| dealer_staff | dealer_id FK, user_id FK (unique), role (OWNER, STAFF) | |
| brands | name, slug (unique), aliases text[], popular, active, sort | Brand 1→N Models |
| models | brand_id FK, name, slug, body_type_id FK, active | unique (brand_id, slug) |
| body_types / fuel_types / transmissions | name, slug (unique), plural, description, sort | |
| locations | slug, name, county, major | |
| features | slug (unique), name, group (safety, interior, exterior, technology) | |
| vehicles | ref (unique short code), brand_id, model_id, variant, year, body_type_id, condition, import_status, engine_cc, fuel_type_id, transmission_id, drive_type, power_hp, mileage_km, seats, airbags, interior_material, colour, estimates jsonb | Technical record; Model 1→N Vehicles |
| listings | vehicle_id (unique FK), slug (unique), seller_id FK users, dealer_id FK null, seller_type, authority_doc_url, price, negotiable, currency, county, town, area, location_id, description, contact_prefs jsonb, status (enum), hidden_by_admin, changes_requested, package_id, featured_until, boosted_until, views, favourites_count, published_at, expires_at, sold_at, deleted_at, search tsvector | User 1→N Listings; Dealer 1→N |
| listing_moderation | listing_id FK, action, status, actor_id, note, created_at | Moderation history |
| vehicle_images | vehicle_id FK, storage_key, url, thumb_url, width, height, alt, position, is_primary | Vehicle 1→N Images |
| vehicle_features | vehicle_id FK, feature_id FK (composite PK) | Vehicle N↔N Features |
| uploads | uploader_id FK, kind, storage_key, mime, bytes, width, height, status | Before an upload is attached |
| favourites | user_id FK, listing_id FK (unique pair) | User N↔N Vehicles |
| conversations | listing_id FK, buyer_id FK, seller_id FK, dealer_id, last_message_at, last_message_preview, buyer_last_read_at, seller_last_read_at | unique (listing_id, buyer_id) |
| messages | conversation_id FK, sender_id FK, body, deleted_at | Conversation 1→N Messages |
| reports | listing_id FK, reporter_id null, reporter_email, reason (enum), details, status, resolution, resolved_by, resolved_at | Vehicle 1→N Reports |
| listing_packages | name, description, price, duration_days, listing_limit, featured, boost_days, analytics, audience, active | |
| listing_purchases | user_id, dealer_id null, package_id, payment_id, listing_id null, starts_at, ends_at | |
| payments | reference (unique), user_id FK, amount, currency, purpose, package_id, listing_id, status (enum PENDING, PROCESSING, SUCCESS, FAILED, CANCELLED, REFUNDED), gateway, method, phone, gateway_ref (unique), receipt, idempotency_key, failure_reason, completed_at | unique (user_id, idempotency_key); User 1→N Payments |
| webhook_events | gateway, event_id (unique), payload jsonb, received_at | Idempotency |
| promotions | title, placement, listing_id, dealer_id, starts_at, ends_at, active | |
| analytics_events | type, listing_id, dealer_id, seller_id, user_id, session_id, count, meta jsonb, created_at | Partition by month; daily rollup tables for dashboards |
| notifications | user_id, type, title, body, link, read_at | |
| outbox | channel, to, user_id, type, subject, body, status, attempts, sent_at | Email, SMS and WhatsApp delivery queue |
| audit_logs | actor_id, action, entity_type, entity_id, meta jsonb, ip, created_at | Append-only |
| cms_pages | slug (unique), title, body, published | |
| seo_records | path (unique), title, description, intro, noindex | |
| settings | key (PK), value jsonb | Moderation, quotas, payment methods, homepage |

## Indexes for search at scale
```sql
CREATE INDEX listings_live_newest ON listings (published_at DESC) WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX listings_live_price  ON listings (price) WHERE status = 'PUBLISHED';
CREATE INDEX vehicles_brand_model_year ON vehicles (brand_id, model_id, year);
CREATE INDEX vehicles_body ON vehicles (body_type_id);
CREATE INDEX vehicles_mileage ON vehicles (mileage_km);
CREATE INDEX listings_location ON listings (location_id);
CREATE INDEX listings_search ON listings USING gin (search);                -- full text
CREATE INDEX brands_name_trgm ON brands USING gin (name gin_trgm_ops);      -- typo tolerance
CREATE INDEX models_name_trgm ON models USING gin (name gin_trgm_ops);
CREATE INDEX listings_boost ON listings (boosted_until) WHERE boosted_until IS NOT NULL;
CREATE INDEX analytics_listing_time ON analytics_events (listing_id, created_at);
```
Use cursor pagination (`published_at, id`) for feeds and exports. Use offset pagination only for the numbered result pages.
