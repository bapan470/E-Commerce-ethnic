Changed file: components/header.tsx

Kya badla:
- Mobile menu (hamburger drawer) me "Shop by Category" list ab sirf un
  categories ko dikhati hai jinme kam se kam 1 product hai. Admin me
  jo categories 0 products wali hain (Blouse, Blouse Pieces, Chanderi
  Sarees, Dress, Dress Material, etc.) — ab menu me nahi dikhengi.
- Design bhi naya hai: har category ek chota card hai — bold naam +
  "X products" count, right side pe us category ke 3 products ki
  stacked circular photos + arrow, alternate maroon/gold tint
  background. Product data load hote waqt halka skeleton animation
  dikhta hai.

Apply kaise karein:
Apne project me components/header.tsx ko is file se replace kar dein.
