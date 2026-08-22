PRODUCT PAGE — VARIANT SWATCHES NOW SCROLL HORIZONTALLY
==========================================================

1 file, matching your repo's folder structure. Copy it into the same
path in your project (overwrite the existing one), then `git push`.

1. components/product/variant-swatches.tsx (MODIFIED)
   - Was `flex flex-wrap` — colour swatches on the product page wrapped
     onto a second row once there were more than ~5 colours (Green,
     Ivory, Navy Blue, Maroon, Forest Green on row 1; Rust Pink, Rani
     Pink dropping to row 2).
   - Now a single-row horizontal-scroll strip (overflow-x-auto, hidden
     scrollbar), same behaviour as the colour swatches inside the video
     shopping Reels feed. Each swatch button got shrink-0 added too —
     without it, flex would just squeeze all the swatches narrower to
     fit instead of actually scrolling.

VERIFIED
--------
Ran `tsc --noEmit` (full project type-check) after this change —
0 errors.
