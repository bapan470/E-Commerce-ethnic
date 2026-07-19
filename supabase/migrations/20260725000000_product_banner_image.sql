-- Adds a per-product "banner image" that can be shown at the top of the
-- product gallery instead of the regular product photos (e.g. a festive
-- sale banner). Falls back to the normal product images when unset.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS banner_url text;
