# Social Media Links — Admin-managed footer icons

This zip mirrors your repo's exact folder structure — copy these 3 files
straight into `E-Commerce-ethnic/`, overwriting the existing ones, then push.

## Files changed (3, no new files, no migration needed)

- `lib/settings-api.ts` — adds a `SocialLinks` type + `fetchSocialLinks()` /
  `saveSocialLinks()`, stored under the existing `settings` table
  (key: `social_links`) — same pattern as your other settings, so **no SQL
  migration is required**.
- `components/admin/settings-panel.tsx` — adds a new "Social Media Links"
  card (Instagram, Facebook, YouTube, Twitter/X, LinkedIn, WhatsApp) right
  below Store Settings on the Admin > Settings page.
- `components/footer.tsx` — footer now reads social links + support
  email/phone from Admin Settings instead of hardcoded values. Any field
  left blank in Admin is simply hidden as an icon — no dead links.

## Steps

1. Copy the 3 files into your repo (same relative paths), overwriting the
   existing ones.
2. `git add -A && git commit -m "Admin-managed social media links in footer" && git push`
3. No database migration needed — it reuses the existing `settings` table.

## How to use it

1. Go to `Admin > Settings`.
2. Scroll to the new **Social Media Links** card.
3. Paste the full profile URL for whichever platforms you use
   (e.g. `https://instagram.com/aruhihandlooms`).
4. Click **Save Social Links**.
5. Refresh the storefront — the footer's "Connect" section now shows only
   the icons you filled in.

Note: Email and phone icons in the footer now come from the existing
**Support email** / **Support phone** fields at the top of Admin > Settings
(Store Settings card) — if those are blank, those two icons just won't show.
