Colour name autosuggest — what changed
=======================================

3 files, replace them at the same paths in your project:

  lib/color-presets.ts
  components/admin/product-variants-manager.tsx   ("Add Colour Variant" popup)
  components/admin/products-panel.tsx             (product form "Colors (comma-separated)" field)

What it does
------------
1. "Add Colour Variant" popup (Colour name field):
   - As you type, a dropdown appears suggesting matching colours from the
     library (e.g. typing "marr" suggests "Maroon").
   - Click a suggestion (or arrow keys + Enter) to pick it — name and hex
     swatch both fill in automatically.
   - If you keep typing something that's NOT in the library, nothing blocks
     you — a small note appears saying it'll be saved as a new custom
     colour, and it saves fine on submit (this already worked before, it
     was just silent).

2. Product form "Colors (comma-separated)" field:
   - Same idea, but works per comma-separated entry. Typing after a comma
     (e.g. "Maroon, go") suggests "Gold" for the segment you're currently
     typing. Picking it inserts "Maroon, Gold, " and leaves your cursor
     ready for the next colour.
   - Typing a name not in the library is fine too — it's just saved as-is.

Nothing else changed — no new dependencies, no database/schema changes.

How to apply
------------
1. Unzip and copy these 3 files into your project at the same relative
   paths, overwriting the existing ones.
2. git add -A && git commit -m "Add colour name autosuggest" && git push

Verified: `npx tsc --noEmit` and `next lint` both pass clean on these files.
