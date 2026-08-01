# Mobile /categories page — colour variations bhi count me

## Kya badla

`app/categories/page.tsx` me har category ka product count ab har colour
variation ko alag product maan ke count karta hai — jaise aapne bola,
"sab color 1 product count" (matlab 1 product jiske 3 colours hain, wo
count me 3 products ki tarah judega — base colour + 2 extra colours = 3).

Pehle: `count: inCat.length` — sirf base product rows count hote the.
Ab: `sum + 1 + (p.variant_list?.length ?? 0)` — har product ki apni base
colour (1) + uske upar add ki hui har extra colour (variant_list) jud ke
count banta hai.

## ⚠️ Dependency — pehle wala patch zaroori hai

Ye change `Product.variant_list` field use karta hai, jo maine pichle
zip (`collections-picker-changes.zip`) me `lib/types.ts` aur
`lib/products-api.ts` me add kiya tha. **Agar wo files abhi tak apply
nahi ki hain**, to ye naya code crash nahi karega (TypeScript optional
field hai, `?? 0` fallback hai), lekin count purane jaisa hi (sirf base
products) rahega — colour variations count nahi honge.

To poora effect chahiye to ye do files bhi zaroor lagi honi chahiye:
- `lib/types.ts` (Product interface me `variant_list` field)
- `lib/products-api.ts` (`mapRowToProduct()` me `variant_list` populate)

Agar wo pehle se apply kar chuke ho, to sirf ye ek file (`app/categories/page.tsx`)
replace karne se kaam ho jayega.

`tsc --noEmit` aur `eslint` dono clean pass ho gaye is file ke saath.
