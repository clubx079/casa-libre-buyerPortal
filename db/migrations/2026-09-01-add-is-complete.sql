-- Marketplace server-side search/pagination foundation.
-- Adds a persisted completeness flag so the DB can filter/paginate the exact
-- marketplace-visible set cheaply (the JS gate is FX-aware and can't run in SQL).
-- Backfill it with scripts/recompute-complete.mjs --commit (run again on a cron).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_complete boolean NOT NULL DEFAULT false;
-- Normalised USD price so price bands + price sort work server-side across the
-- mixed USD/₲ data (also written by scripts/recompute-complete.mjs).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_usd numeric;

-- Fast path for `is_complete=true AND admin_status='active' AND listing_type=…`.
CREATE INDEX IF NOT EXISTS idx_props_complete
  ON properties (is_complete, admin_status, listing_type);
CREATE INDEX IF NOT EXISTS idx_props_price_usd ON properties (price_usd) WHERE is_complete;
