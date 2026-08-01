# Product Highlights — labels + text size

## Kya badla (`components/product/product-highlights.tsx`)

1. **"Border" → "Saree Fabric"** — ab is jagah `highlights.saree_fabric`
   (ya fallback me product ka `fabric`) dikhega.
2. **"Border Width" → "Transparency"** — ab is jagah `highlights.transparency`
   dikhega.
3. Duplicate na ho isliye ye dono fields "Additional Details" (expanded)
   section se hata di gayi hain — pehle wahan bhi the.
4. **Text size chota kiya** — label `text-xs` → `text-[11px]`, value
   `text-sm` → `text-xs`. Ye poore Product Highlights box (Occasion, Saree
   Fabric, Transparency, Blouse + Additional Details ke saare fields) pe
   apply hota hai, kyunki sab same `Cell` component use karte hain.

Agar kisi product ka `saree_fabric` ya `transparency` value khaali hai (blank),
to us product par wo field bilkul nahi dikhegi (jaisa pehle bhi tha — 
empty fields hide ho jaati hain).

`tsc --noEmit` aur `eslint` dono clean pass ho gaye.
