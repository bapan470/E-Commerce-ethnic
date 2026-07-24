SOCIAL SHARE BUTTONS — Facebook / Instagram / Threads (separate buttons)
=========================================================================

WHAT CHANGED
------------
Admin > Products (Manage Products / products-panel.tsx) now shows THREE
separate icon buttons per product row instead of one combined "Share"
button — one each for Facebook, Instagram, and Threads. Each button:
  - Shares ONLY that platform when clicked (not all three at once).
  - Shows its own "✓ Posted" state once that specific platform has been
    posted to (independent of the other two).
  - Has its own re-share confirmation dialog.

FILES IN THIS ZIP (replace at the same path in your repo)
-----------------------------------------------------------
  components/admin/products-panel.tsx
  app/api/social/publish/route.ts
  app/api/admin/product-social-status/route.ts
  lib/social-publish-api.ts
  lib/vendor-api.ts

CHANGES.diff — unified diff of the same 5 files, in case you'd rather
review/apply it with `git apply CHANGES.diff` from the repo root instead
of copying files over by hand.

HOW TO APPLY
------------
Option A (copy files):
  Copy the 5 files above into your repo, overwriting the existing ones at
  the exact same paths, then commit + push as usual.

Option B (git apply):
  From your repo root:
    git apply CHANGES.diff
  (If it fails to apply cleanly, it's almost always because your local
  copy of one of these 5 files has diverged — just use Option A instead.)

DATABASE
--------
No new migration needed — this reuses the existing social_post_ids jsonb
column on products (already added by
supabase/migrations/20260819000000_social_auto_publish.sql) and now
merges into it per-platform (facebook_post_id / instagram_media_id /
threads_post_id) instead of overwriting the whole object on every post.

NOTES
-----
- Facebook/Instagram/Threads still need to be enabled + configured with
  valid credentials in Admin > Marketing > Social Auto-Post for their
  respective buttons to actually post (same as before — this only
  changes how many buttons there are and how they're gated, not the
  underlying Meta/Threads API calls).
- Typechecked clean with `npx tsc --noEmit` against this repo before
  packaging.
