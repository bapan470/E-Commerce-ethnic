CHANGES — Vendor Dashboard: "Products" tab with Add Product inside it
========================================================================

WHAT CHANGED
------------
1. components/vendor/sidebar-nav.tsx
   - Sidebar item "Add Product" replaced with "Products"
     (now points to /vendor/dashboard/products)

2. app/vendor/dashboard/products/page.tsx   [NEW FILE]
   - New "Products" tab page — lists ALL your products (not just
     recent 5) with status badges, and has an "Add Product" button
     at the top that opens the add-product form.

3. app/vendor/dashboard/products/add-product/page.tsx   [MOVED]
   - This is the same Add Product form that used to live at
     app/vendor/dashboard/add-product/page.tsx.
   - It has been MOVED to app/vendor/dashboard/products/add-product/page.tsx
     so it lives inside the Products section (URL:
     /vendor/dashboard/products/add-product).
   - Its "back" link now points to the Products tab instead of the
     main dashboard.

4. app/vendor/dashboard/page.tsx
   - "Add Product" button and "Your Products" card links updated to
     point to the new /vendor/dashboard/products routes.

HOW TO APPLY (IMPORTANT — includes a delete step)
--------------------------------------------------
1. Copy/replace these files into your project at the SAME paths:
     app/vendor/dashboard/page.tsx
     app/vendor/dashboard/products/page.tsx
     app/vendor/dashboard/products/add-product/page.tsx
     components/vendor/sidebar-nav.tsx

2. DELETE the old file/folder (it has moved, so this old path must
   not remain or you'll have a duplicate/orphan route):
     app/vendor/dashboard/add-product/         (delete this whole folder)

3. git add -A
   git commit -m "Vendor dashboard: move Add Product inside Products tab"
   git push

That's it — no other files were touched.
